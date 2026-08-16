/**
 * MicrophoneManager — Single Source of Truth for all audio capture
 * 
 * Architecture:
 * - ONE getUserMedia stream (shared across VAD, visualizer, and speech)
 * - ONE SpeechRecognition instance (shared across wake-word, commands, and meeting)
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
  private mode: MicMode = 'idle';
  private isListening = false;
  private callbacks: MicCallbacks = {};
  private animFrameId: number | null = null;
  private silenceTimer: any = null;
  private wakeWordDetected = false;
  private interimTranscript = '';
  private finalTranscript = '';

  // Singleton
  public static getInstance(): MicrophoneManager {
    if (!MicrophoneManager.instance) {
      MicrophoneManager.instance = new MicrophoneManager();
    }
    return MicrophoneManager.instance;
  }

  private constructor() {}

  // Initialize once: request mic permission and warm up AudioContext
  async initialize(): Promise<boolean> {
    if (this.stream?.active) return true;
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
      console.error('[MicManager] Initialization failed:', e?.message || e);
      return false;
    }
  }

  // Start the shared SpeechRecognition in a specific mode
  async start(mode: MicMode, callbacks: MicCallbacks = {}): Promise<boolean> {
    const initialized = await this.initialize();
    if (!initialized) {
      callbacks.onError?.('Microphone access denied');
      return false;
    }

    // If already running in a different mode, stop first to prevent conflict
    if (this.isListening && this.mode !== mode) {
      this.stop();
    }

    this.mode = mode;
    this.callbacks = callbacks;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      callbacks.onError?.('Speech recognition not supported');
      return false;
    }

    // Create recognition once, reuse it
    if (!this.recognition) {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = 'en-US';

      this.recognition.onresult = (event: any) => {
        this.handleResult(event);
      };

      this.recognition.onerror = (event: any) => {
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          console.error('[MicManager] Permission denied:', event.error);
          this.callbacks.onError?.('Microphone permission denied');
          this.isListening = false;
          return;
        }
        if (event.error !== 'no-speech' && event.error !== 'aborted') {
          console.warn('[MicManager] Recognition notice:', event.error);
        }
      };

      this.recognition.onend = () => {
        if (this.isListening) {
          // Auto-restart if still supposed to be listening
          setTimeout(() => {
            if (this.isListening) this.safeStart();
          }, 300);
        }
      };
    }

    this.isListening = true;
    this.safeStart();
    this.startVolumeLoop();
    return true;
  }

  private safeStart() {
    try {
      if (this.recognition && (!('readyState' in this.recognition) || this.recognition.readyState !== 1)) {
        this.recognition.start();
      }
    } catch (e: any) {
      console.warn('[MicManager] Start notice:', e?.message);
    }
  }

  private handleResult(event: any) {
    let interim = '';
    let final = '';

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        final += transcript;
      } else {
        interim += transcript;
      }
    }

    this.interimTranscript = interim;
    this.finalTranscript += final;

    // Route based on mode
    if (this.mode === 'wake-word') {
      const lower = (this.finalTranscript + interim).toLowerCase();
      if (!this.wakeWordDetected && 
          (lower.includes('hey ahri') || lower.includes('hi ahri') || lower.includes('okay ahri') || lower.includes('ahri') || lower.includes('friday') || lower.includes('jarvis'))) {
        this.wakeWordDetected = true;
        this.callbacks.onWakeWord?.();
        this.resetSilenceTimer();
      }
      // After wake word, route final transcripts as commands
      if (this.wakeWordDetected && final) {
        const clean = final.replace(/^(?:hey\s+|hi\s+|okay\s+)?(?:ahri|friday|jarvis)[,\s]*/i, '').trim();
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
      if (this.mode === 'wake-word' && this.wakeWordDetected) {
        this.wakeWordDetected = false;
        this.finalTranscript = '';
        this.interimTranscript = '';
      }
    }, 2000);
  }

  private startVolumeLoop() {
    if (!this.analyser) return;
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    
    const update = () => {
      if (!this.isListening || !this.analyser) return;
      this.analyser.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
      const avg = sum / dataArray.length / 255;
      this.callbacks.onVolume?.(avg);
      this.animFrameId = requestAnimationFrame(update);
    };
    
    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
    this.animFrameId = requestAnimationFrame(update);
  }

  stop() {
    this.isListening = false;
    this.mode = 'idle';
    this.wakeWordDetected = false;
    this.finalTranscript = '';
    this.interimTranscript = '';
    
    if (this.silenceTimer) clearTimeout(this.silenceTimer);
    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
    
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {}
      // Do NOT destroy the recognition instance, just stop it
      // so it can be restarted in a different mode
    }
  }

  // Full teardown (call on app quit)
  destroy() {
    this.stop();
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      try { this.audioContext.close(); } catch {}
      this.audioContext = null;
    }
    this.recognition = null;
    MicrophoneManager.instance = null as any;
  }

  getStream(): MediaStream | null {
    return this.stream;
  }

  getAudioContext(): AudioContext | null {
    return this.audioContext;
  }

  getMode(): MicMode {
    return this.mode;
  }

  isActive(): boolean {
    return this.isListening;
  }
}

export const microphoneManager = MicrophoneManager.getInstance();
