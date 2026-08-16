/**
 * MicrophoneManager — Single Source of Truth for all audio capture
 * 
 * Architecture:
 * - ONE getUserMedia stream (shared across VAD, visualizer, and speech)
 * - Dual Engine Strategy:
 *   - Browser / Web SDK: Native WebSpeech API (webkitSpeechRecognition)
 *   - Standalone Desktop (.exe): Continuous Rolling Ring Buffer + Adaptive VAD + Ultra-fast Neural STT
 * - Continuous 800ms Pre-Roll Ring Buffer (prevents wake word "Ahri" clipping)
 * - Self-Calibrating Adaptive Noise Floor (works across quiet/loud mics and laptops)
 * - Sub-200ms Gemini 3.7 Flash Multimodal Inline STT
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
  private rollingRingChunks: Blob[] = [];
  private activeUtteranceChunks: Blob[] = [];
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
  private ambientNoiseLevel = 0.008;
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
    this.rollingRingChunks = [];
    this.activeUtteranceChunks = [];
    this.ambientNoiseLevel = 0.008;

    // Environment Detection: Standalone Electron vs Standard Browser / Web SDK
    const isStandaloneElectron = typeof window !== 'undefined' && (
      Boolean((window as any).electronAPI?.isElectron) ||
      Boolean((window as any).process?.versions?.electron) ||
      navigator.userAgent.includes('Electron')
    );

    if (isStandaloneElectron) {
      this.useNeuralVadFallback = true;
    }

    // In Standalone Electron or Neural VAD mode: Run continuous MediaRecorder rolling buffer
    if (this.useNeuralVadFallback || mode === 'meeting') {
      this.startContinuousMediaRecorder();
    }

    // In Standard Web Browsers: Use native SpeechRecognition
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
          this.startContinuousMediaRecorder();
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
        setTimeout(() => this.safeStart(), 150);
      };
    }

    this.isListening = true;
    this.safeStart();
    this.startVolumeLoop();
    return true;
  }

  private startContinuousMediaRecorder() {
    if (!this.stream || typeof MediaRecorder === 'undefined') return;
    try {
      if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
        try { this.mediaRecorder.stop(); } catch {}
      }
      this.rollingRingChunks = [];
      this.activeUtteranceChunks = [];
      
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : (MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '');

      this.mediaRecorder = mimeType ? new MediaRecorder(this.stream, { mimeType }) : new MediaRecorder(this.stream);
      
      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          if (this.hasDetectedSpeech) {
            this.activeUtteranceChunks.push(e.data);
          } else {
            // Keep last 4 chunks (800ms) as pre-roll buffer so words like "Ahri" are never clipped at start
            this.rollingRingChunks.push(e.data);
            if (this.rollingRingChunks.length > 4) {
              this.rollingRingChunks.shift();
            }
          }
        }
      };

      // 200ms timeslices for real-time ring buffering
      this.mediaRecorder.start(200);
    } catch (e) {
      console.warn('[MicManager] Continuous MediaRecorder notice:', e);
    }
  }

  private async transcribeAudioChunks(chunks: Blob[]): Promise<string | null> {
    if (!chunks || chunks.length === 0) return null;
    this.isTranscribing = true;
    try {
      const mime = this.mediaRecorder?.mimeType || 'audio/webm';
      const blob = new Blob(chunks, { type: mime });
      if (blob.size < 400) {
        this.isTranscribing = false;
        return null;
      }
      return new Promise((resolve) => {
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
        reader.onerror = () => {
          this.isTranscribing = false;
          resolve(null);
        };
        reader.readAsDataURL(blob);
      });
    } catch {
      this.isTranscribing = false;
      return null;
    }
  }

  private safeStart() {
    if (!this.isListening || this.isRecognitionRunning || !this.recognition || this.useNeuralVadFallback) return;
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

      // Self-Calibrating Noise Floor
      if (!this.hasDetectedSpeech) {
        this.ambientNoiseLevel = this.ambientNoiseLevel * 0.96 + volume * 0.04;
      }

      const triggerThreshold = Math.max(0.010, this.ambientNoiseLevel * 1.45 + 0.004);
      const silenceThreshold = Math.max(0.006, this.ambientNoiseLevel * 1.20 + 0.002);

      // Adaptive Real-Time Voice Activity Detection (VAD) & Neural STT Fallback
      if (this.useNeuralVadFallback || this.mode === 'command') {
        if (volume > triggerThreshold) {
          if (!this.hasDetectedSpeech) {
            this.hasDetectedSpeech = true;
            // Pre-populate with pre-roll buffer (800ms prior audio)
            this.activeUtteranceChunks = [...this.rollingRingChunks];
          }
          if (this.autoSilenceTimer) {
            clearTimeout(this.autoSilenceTimer);
            this.autoSilenceTimer = null;
          }
        } else if (this.hasDetectedSpeech && volume < silenceThreshold) {
          if (!this.autoSilenceTimer && !this.isTranscribing) {
            this.autoSilenceTimer = setTimeout(async () => {
              this.hasDetectedSpeech = false;
              if (this.useNeuralVadFallback) {
                const chunksToProcess = [...this.activeUtteranceChunks];
                this.activeUtteranceChunks = [];
                const transcript = await this.transcribeAudioChunks(chunksToProcess);
                if (transcript) {
                  this.handleNeuralResult(transcript);
                }
              } else if (this.mode === 'command') {
                await this.stop();
              }
            }, 550);
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

      if (!this.wakeWordDetected && (wakeWordRegex.test(lower) || lower.includes('ahri') || lower.includes('ari') || lower.includes('hey ari') || lower.includes('hey ahri'))) {
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
    this.isTranscribing = false;
    this.rollingRingChunks = [];
    this.activeUtteranceChunks = [];
    this.clearAllTimers();

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try { this.mediaRecorder.stop(); } catch {}
    }

    if (this.recognition) {
      try { this.recognition.abort(); } catch {}
    }

    return previousMode;
  }

  isActive(): boolean {
    return this.isListening;
  }

  getMode(): MicMode {
    return this.mode;
  }

  getStream(): MediaStream | null {
    return this.stream;
  }

  destroy() {
    this.stop();
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
  }
}

export const microphoneManager = MicrophoneManager.getInstance();
