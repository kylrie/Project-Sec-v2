/**
 * MicrophoneManager — Single Source of Truth for all audio capture
 * 
 * Architecture:
 * - ONE getUserMedia stream (shared across VAD, visualizer, and speech)
 * - ONE SpeechRecognition instance (shared across wake-word, commands, and meeting)
 * - Parallel MediaRecorder audio buffer with AI STT fallback (for Electron/offline)
 * - Mode-based routing: 'idle' | 'wake-word' | 'command' | 'meeting'
 * 
 * The browser only allows ONE active SpeechRecognition at a time.
 * This manager enforces that rule so modules stop fighting each other.
 */

export type MicMode = 'idle' | 'wake-word' | 'command' | 'meeting';

export interface MicCallbacks {
  onTranscript?: (text: string, isFinal: boolean) => void;
  onVolume?: (level: number) => void;
  onError?: (error: string) => void;
  onWakeWord?: () => void;
}

export class MicrophoneManager {
  private static instance: MicrophoneManager;
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private recognition: any = null;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private mode: MicMode = 'idle';
  private isListening = false;
  private isRecognitionRunning = false;
  private consecutiveNetworkErrors = 0;
  private callbacks: MicCallbacks = {};
  private animFrameId: number | null = null;
  private silenceTimer: any = null;
  private wakeWordDetected = false;
  private interimTranscript = '';
  private finalTranscript = '';

  public static getInstance(): MicrophoneManager {
    if (!MicrophoneManager.instance) {
      MicrophoneManager.instance = new MicrophoneManager();
    }
    return MicrophoneManager.instance;
  }

  private constructor() {}

  async initialize(): Promise<boolean> {
    if (this.stream && this.stream.active) return true;
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false
      });
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.audioContext = new AudioCtx();
        if (this.audioContext.state === 'suspended') {
          await this.audioContext.resume().catch(() => {});
        }
        const source = this.audioContext.createMediaStreamSource(this.stream);
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 32;
        this.analyser.smoothingTimeConstant = 0.8;
        source.connect(this.analyser);
      }
      return true;
    } catch (e: any) {
      console.error('[MicManager] Init failed:', e?.message || e);
      return false;
    }
  }

  async start(mode: MicMode, callbacks: MicCallbacks = {}): Promise<boolean> {
    const ok = await this.initialize();
    if (!ok) {
      callbacks.onError?.('Microphone access denied');
      return false;
    }

    // If already running in a different mode, stop first
    if (this.isListening && this.mode !== mode) {
      await this.stop();
    }

    if (this.silenceTimer) clearTimeout(this.silenceTimer);
    this.mode = mode;
    this.callbacks = callbacks;
    this.wakeWordDetected = false;
    this.finalTranscript = '';
    this.interimTranscript = '';

    // Start parallel audio recording buffer for high-accuracy fallback
    this.startMediaRecorder();

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition && !this.recognition) {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = 'en-US';

      this.recognition.onstart = () => {
        this.isRecognitionRunning = true;
      };

      this.recognition.onresult = (e: any) => {
        this.consecutiveNetworkErrors = 0;
        this.handleResult(e);
      };

      this.recognition.onerror = (e: any) => {
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
          console.error('[MicManager] Permission denied:', e.error);
          this.callbacks.onError?.('Microphone permission denied');
          this.isListening = false;
          this.isRecognitionRunning = false;
          return;
        }
        if (e.error === 'network') {
          this.consecutiveNetworkErrors++;
          if (this.consecutiveNetworkErrors === 1) {
            console.info('[MicManager] Web Speech API network offline in this environment. Parallel AI audio buffer active.');
          }
        } else {
          this.consecutiveNetworkErrors = 0;
        }
        if (e.error !== 'no-speech' && e.error !== 'aborted' && e.error !== 'network') {
          console.warn('[MicManager] Recognition notice:', e.error);
        }
      };

      this.recognition.onend = () => {
        this.isRecognitionRunning = false;
        if (!this.isListening) return;
        const retryDelay = this.consecutiveNetworkErrors > 0
          ? Math.min(8000, 2000 + this.consecutiveNetworkErrors * 1000)
          : 300;
        setTimeout(() => this.safeStart(), retryDelay);
      };
    }

    this.isListening = true;
    this.safeStart();
    this.startVolumeLoop();
    return true;
  }

  private startMediaRecorder() {
    if (!this.stream || typeof MediaRecorder === 'undefined') return;
    try {
      if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
        try { this.mediaRecorder.stop(); } catch {}
      }
      this.recordedChunks = [];
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : (MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '');

      this.mediaRecorder = mimeType ? new MediaRecorder(this.stream, { mimeType }) : new MediaRecorder(this.stream);
      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          this.recordedChunks.push(e.data);
        }
      };
      this.mediaRecorder.start(250);
    } catch (e) {
      console.warn('[MicManager] MediaRecorder notice:', e);
    }
  }

  private async stopMediaRecorderAndTranscribe(): Promise<string | null> {
    if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') return null;
    return new Promise((resolve) => {
      this.mediaRecorder!.onstop = async () => {
        if (this.recordedChunks.length === 0) {
          resolve(null);
          return;
        }
        try {
          const mime = this.mediaRecorder?.mimeType || 'audio/webm';
          const blob = new Blob(this.recordedChunks, { type: mime });
          this.recordedChunks = [];
          if (blob.size < 500) {
            resolve(null);
            return;
          }
          const reader = new FileReader();
          reader.onloadend = async () => {
            try {
              const base64Audio = (reader.result as string).split(',')[1];
              const res = await fetch('/api/transcribe-audio', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ audioBase64: base64Audio, mimeType: mime })
              });
              if (res.ok) {
                const data = await res.json();
                resolve(data.transcript || null);
              } else {
                resolve(null);
              }
            } catch {
              resolve(null);
            }
          };
          reader.readAsDataURL(blob);
        } catch {
          resolve(null);
        }
      };
      try {
        this.mediaRecorder!.stop();
      } catch {
        resolve(null);
      }
    });
  }

  private safeStart() {
    if (!this.isListening || this.isRecognitionRunning || !this.recognition) return;
    try {
      this.recognition.start();
      this.isRecognitionRunning = true;
    } catch (e: any) {
      if (!e?.message?.includes('already started')) {
        console.warn('[MicManager] Start notice:', e?.message);
      }
    }
  }

  private handleResult(event: any) {
    let interim = '';
    let final = '';

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const t = event.results[i][0].transcript;
      if (event.results[i].isFinal) final += t;
      else interim += t;
    }

    this.interimTranscript = interim;
    this.finalTranscript += final;

    if (this.mode === 'wake-word') {
      const text = (this.finalTranscript + interim).toLowerCase();
      if (!this.wakeWordDetected && /\b(?:hey\s+|hi\s+|okay\s+)?(?:ahri|friday|jarvis)\b/i.test(text)) {
        this.wakeWordDetected = true;
        this.callbacks.onWakeWord?.();
        this.resetSilenceTimer();
      }
      if (this.wakeWordDetected && final) {
        const clean = final.replace(/\b(?:hey\s+|hi\s+|okay\s+)?(?:ahri|friday|jarvis)\b[,\s]*/gi, '').trim();
        if (clean) {
          this.callbacks.onTranscript?.(clean, true);
          this.resetSilenceTimer();
        }
      }
    } else if (this.mode === 'command' || this.mode === 'meeting') {
      if (interim) this.callbacks.onTranscript?.(interim, false);
      if (final) this.callbacks.onTranscript?.(final, true);
    }
  }

  private resetSilenceTimer() {
    if (this.silenceTimer) clearTimeout(this.silenceTimer);
    this.silenceTimer = setTimeout(() => {
      if (this.mode === 'wake-word') {
        this.wakeWordDetected = false;
        this.finalTranscript = '';
        this.interimTranscript = '';
      }
    }, 3000);
  }

  private startVolumeLoop() {
    if (!this.analyser) return;
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    const loop = () => {
      if (!this.isListening || !this.analyser) return;
      this.analyser.getByteFrequencyData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += data[i];
      this.callbacks.onVolume?.(sum / data.length / 255);
      this.animFrameId = requestAnimationFrame(loop);
    };
    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
    this.animFrameId = requestAnimationFrame(loop);
  }

  async stop() {
    this.isListening = false;
    this.isRecognitionRunning = false;
    const previousMode = this.mode;
    this.mode = 'idle';
    this.wakeWordDetected = false;
    if (this.silenceTimer) clearTimeout(this.silenceTimer);
    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
    if (this.recognition) {
      try { this.recognition.stop(); } catch {}
    }

    // If manual command mode ended and Web Speech API had network error (no transcript generated), transcribe audio buffer
    if ((previousMode === 'command' || previousMode === 'meeting') && !this.finalTranscript && this.mediaRecorder) {
      const fallbackText = await this.stopMediaRecorderAndTranscribe();
      if (fallbackText && fallbackText.trim()) {
        this.callbacks.onTranscript?.(fallbackText.trim(), true);
      }
    } else if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try { this.mediaRecorder.stop(); } catch {}
    }
  }

  destroy() {
    this.stop();
    this.stream?.getTracks().forEach(t => t.stop());
    this.stream = null;
    if (this.audioContext?.state !== 'closed') {
      try { this.audioContext?.close(); } catch {}
    }
    this.audioContext = null;
    this.recognition = null;
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.isRecognitionRunning = false;
    MicrophoneManager.instance = null as any;
  }

  getStream(): MediaStream | null { return this.stream; }
  getAudioContext(): AudioContext | null { return this.audioContext; }
  getAnalyser(): AnalyserNode | null { return this.analyser; }
  getMode(): MicMode { return this.mode; }
  isActive(): boolean { return this.isListening; }
}

export const microphoneManager = MicrophoneManager.getInstance();
