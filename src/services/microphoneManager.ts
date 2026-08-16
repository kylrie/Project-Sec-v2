/**
 * MicrophoneManager — Single Source of Truth for all audio capture
 * 
 * Architecture:
 * - ONE getUserMedia stream (shared across VAD, visualizer, and speech)
 * - ONE SpeechRecognition instance (shared across wake-word, commands, and meeting)
 * - Real-time Voice Activity Detection (VAD) with automatic 750ms silence cutoff
 * - Parallel MediaRecorder audio buffer with ultra-fast Gemini Flash STT
 * - Mode-based routing: 'idle' | 'wake-word' | 'command' | 'meeting'
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
  private isTranscribing = false;
  private useNeuralVadFallback = false;
  private consecutiveNetworkErrors = 0;
  private callbacks: MicCallbacks = {};
  private animFrameId: number | null = null;
  private silenceTimer: any = null;
  private autoSilenceTimer: any = null;
  private hasDetectedSpeech = false;
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
        this.analyser.fftSize = 64;
        this.analyser.smoothingTimeConstant = 0.6;
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

    this.clearAllTimers();
    this.mode = mode;
    this.callbacks = callbacks;
    this.wakeWordDetected = false;
    this.hasDetectedSpeech = false;
    this.isTranscribing = false;
    this.finalTranscript = '';
    this.interimTranscript = '';

    // Start parallel audio recording buffer for high-accuracy fallback
    this.startMediaRecorder();

    // Environment Detection: Standalone Electron vs Standard Browser / Web SDK
    const isStandaloneElectron = typeof window !== 'undefined' && (
      Boolean((window as any).electronAPI?.isElectron) ||
      Boolean((window as any).process?.versions?.electron) ||
      navigator.userAgent.includes('Electron')
    );

    if (isStandaloneElectron) {
      this.useNeuralVadFallback = true;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition && !this.recognition && !isStandaloneElectron) {
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
        if (e.error === 'service-not-allowed' || e.error === 'network') {
          console.info('[MicManager] WebSpeech notice:', e.error, '- Neural VAD active.');
          this.useNeuralVadFallback = true;
          this.isRecognitionRunning = false;
          return;
        }
        if (e.error === 'not-allowed') {
          console.error('[MicManager] Permission denied:', e.error);
          this.callbacks.onError?.('Microphone permission denied');
          this.isListening = false;
          this.isRecognitionRunning = false;
          return;
        }
        if (e.error !== 'no-speech' && e.error !== 'aborted') {
          console.warn('[MicManager] Recognition notice:', e.error);
        }
      };

      this.recognition.onend = () => {
        this.isRecognitionRunning = false;
        if (!this.isListening) return;
        // Instant restart (150ms) to ensure continuous listening in web browser
        setTimeout(() => this.safeStart(), 150);
      };
    }

    this.isListening = true;
    this.safeStart();
    this.startVolumeLoop();
    return true;
  }

  private startMediaRecorder() {
    if (this.mode !== 'meeting' || !this.stream || typeof MediaRecorder === 'undefined') return;
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
      this.mediaRecorder.start(100);
    } catch (e) {
      console.warn('[MicManager] MediaRecorder notice:', e);
    }
  }

  private async stopMediaRecorderAndTranscribe(): Promise<string | null> {
    if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') return null;
    this.isTranscribing = true;
    return new Promise((resolve) => {
      this.mediaRecorder!.onstop = async () => {
        if (this.recordedChunks.length === 0) {
          this.isTranscribing = false;
          resolve(null);
          return;
        }
        try {
          const mime = this.mediaRecorder?.mimeType || 'audio/webm';
          const blob = new Blob(this.recordedChunks, { type: mime });
          this.recordedChunks = [];
          if (blob.size < 400) {
            this.isTranscribing = false;
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
              this.isTranscribing = false;
              if (res.ok) {
                const data = await res.json();
                resolve(data.transcript || null);
              } else {
                resolve(null);
              }
            } catch {
              this.isTranscribing = false;
              resolve(null);
            }
          };
          reader.readAsDataURL(blob);
        } catch {
          this.isTranscribing = false;
          resolve(null);
        }
      };
      try {
        this.mediaRecorder!.stop();
      } catch {
        this.isTranscribing = false;
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
      const wakeWordRegex = /\b(?:hey\s+|hi\s+|okay\s+)?(?:ahri|ari|aria|harry|airy|aerie|aury|eric|ah\s*ree|friday|jarvis)\b/i;
      
      if (!this.wakeWordDetected && (wakeWordRegex.test(text) || text.includes('ahri') || text.includes('ari') || text.includes('hey ari') || text.includes('hey ahri'))) {
        this.wakeWordDetected = true;
        this.callbacks.onWakeWord?.();
        this.finalTranscript = '';
        this.interimTranscript = '';
        this.resetSilenceTimer();
      }
      
      if (this.wakeWordDetected) {
        if (interim) {
          const cleanInterim = interim.replace(/\b(?:hey\s+|hi\s+|okay\s+)?(?:ahri|ari|aria|harry|airy|aerie|aury|eric|ah\s*ree|friday|jarvis)\b[,\s]*/gi, '').trim();
          if (cleanInterim) {
            this.callbacks.onTranscript?.(cleanInterim, false);
            this.resetSilenceTimer();
          }
        }
        if (final) {
          const cleanFinal = final.replace(/\b(?:hey\s+|hi\s+|okay\s+)?(?:ahri|ari|aria|harry|airy|aerie|aury|eric|ah\s*ree|friday|jarvis)\b[,\s]*/gi, '').trim();
          if (cleanFinal) {
            this.callbacks.onTranscript?.(cleanFinal, true);
            this.resetSilenceTimer();
            this.finalTranscript = '';
          }
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
    }, 8000);
  }

  private startVolumeLoop() {
    if (!this.analyser) return;
    const data = new Uint8Array(this.analyser.frequencyBinCount);

    const loop = () => {
      if (!this.isListening || !this.analyser) return;
      this.analyser.getByteFrequencyData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += data[i];
      const volume = sum / data.length / 255;
      this.callbacks.onVolume?.(volume);

      // Adaptive Real-Time Voice Activity Detection (VAD) & Neural STT Fallback
      if (this.useNeuralVadFallback || this.mode === 'command') {
        if (volume > 0.035) {
          this.hasDetectedSpeech = true;
          if (this.useNeuralVadFallback && (!this.mediaRecorder || this.mediaRecorder.state === 'inactive')) {
            try {
              this.recordedChunks = [];
              const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
                ? 'audio/webm;codecs=opus'
                : (MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '');
              this.mediaRecorder = mimeType ? new MediaRecorder(this.stream!, { mimeType }) : new MediaRecorder(this.stream!);
              this.mediaRecorder.ondataavailable = (e) => {
                if (e.data && e.data.size > 0) this.recordedChunks.push(e.data);
              };
              this.mediaRecorder.start(100);
            } catch {}
          }
          if (this.autoSilenceTimer) {
            clearTimeout(this.autoSilenceTimer);
            this.autoSilenceTimer = null;
          }
        } else if (this.hasDetectedSpeech && volume < 0.02) {
          if (!this.autoSilenceTimer && !this.isTranscribing) {
            this.autoSilenceTimer = setTimeout(async () => {
              this.hasDetectedSpeech = false;
              if (this.useNeuralVadFallback) {
                const transcript = await this.stopMediaRecorderAndTranscribe();
                if (transcript) {
                  this.handleNeuralResult(transcript);
                }
              } else if (this.mode === 'command') {
                await this.stop();
              }
            }, 650);
          }
        }
      }

      this.animFrameId = requestAnimationFrame(loop);
    };

    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
    this.animFrameId = requestAnimationFrame(loop);
  }

  private handleNeuralResult(transcript: string) {
    const text = transcript.trim();
    if (!text) return;

    if (this.mode === 'wake-word') {
      const lower = text.toLowerCase();
      const wakeWordRegex = /\b(?:hey\s+|hi\s+|okay\s+)?(?:ahri|ari|aria|harry|airy|aerie|aury|eric|ah\s*ree|friday|jarvis)\b/i;

      if (!this.wakeWordDetected && (wakeWordRegex.test(lower) || lower.includes('ahri') || lower.includes('ari'))) {
        this.wakeWordDetected = true;
        this.callbacks.onWakeWord?.();
        this.resetSilenceTimer();

        const clean = lower.replace(/\b(?:hey\s+|hi\s+|okay\s+)?(?:ahri|ari|aria|harry|airy|aerie|aury|eric|ah\s*ree|friday|jarvis)\b[,\s]*/gi, '').trim();
        if (clean) {
          this.callbacks.onTranscript?.(clean, true);
        }
      } else if (this.wakeWordDetected) {
        const clean = lower.replace(/\b(?:hey\s+|hi\s+|okay\s+)?(?:ahri|ari|aria|harry|airy|aerie|aury|eric|ah\s*ree|friday|jarvis)\b[,\s]*/gi, '').trim();
        if (clean) {
          this.callbacks.onTranscript?.(clean, true);
          this.resetSilenceTimer();
        }
      }
    } else if (this.mode === 'command' || this.mode === 'meeting') {
      this.callbacks.onTranscript?.(text, true);
    }
  }

  private clearAllTimers() {
    if (this.silenceTimer) { clearTimeout(this.silenceTimer); this.silenceTimer = null; }
    if (this.autoSilenceTimer) { clearTimeout(this.autoSilenceTimer); this.autoSilenceTimer = null; }
    if (this.animFrameId) { cancelAnimationFrame(this.animFrameId); this.animFrameId = null; }
  }

  async stop() {
    this.isListening = false;
    this.isRecognitionRunning = false;
    const previousMode = this.mode;
    this.mode = 'idle';
    this.wakeWordDetected = false;
    this.hasDetectedSpeech = false;
    this.clearAllTimers();

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
