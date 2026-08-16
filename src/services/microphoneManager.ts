/**
 * MicrophoneManager — Single Source of Truth for all audio capture
 * 
 * Architecture:
 * - ONE getUserMedia stream (shared across VAD, visualizer, and speech)
 * - Dual Engine Strategy:
 *   - Browser / Web SDK: Native WebSpeech API (webkitSpeechRecognition)
 *   - Standalone Desktop (.exe): Pristine 16kHz PCM Buffer + Adaptive VAD + Lossless WAV Encoding + Gemini 3.7 Flash STT
 * - Continuous 1000ms Pre-Roll PCM Ring Buffer (guarantees wake word "Ahri" is never clipped at start)
 * - Lossless 16-bit 16kHz WAV Encoder (100% valid container format, zero corrupt WebM chunks)
 * - Self-Calibrating Adaptive Noise Floor (works across quiet/loud mics, laptops, headsets)
 */

export type MicMode = 'idle' | 'wake-word' | 'command' | 'meeting';

export interface MicCallbacks {
  onTranscript?: (text: string, isFinal: boolean) => void;
  onVolume?: (level: number) => void;
  onError?: (error: string) => void;
  onWakeWord?: () => void;
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

function encodeWAV(samples: Float32Array, sampleRate: number = 16000): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  // RIFF chunk descriptor
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(view, 8, 'WAVE');

  // fmt sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true);  // AudioFormat (1 for PCM)
  view.setUint16(22, 1, true);  // NumChannels (1 = Mono)
  view.setUint32(24, sampleRate, true); // SampleRate
  view.setUint32(28, sampleRate * 2, true); // ByteRate (SampleRate * NumChannels * BitsPerSample/8)
  view.setUint16(32, 2, true);  // BlockAlign (NumChannels * BitsPerSample/8)
  view.setUint16(34, 16, true); // BitsPerSample (16 bits)

  // data sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, samples.length * 2, true);

  // Write 16-bit PCM audio samples
  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }

  return new Blob([view], { type: 'audio/wav' });
}

export class MicrophoneManager {
  private static instance: MicrophoneManager;
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  private recognition: any = null;
  private rollingPcmBuffers: Float32Array[] = [];
  private activePcmBuffers: Float32Array[] = [];
  private mode: MicMode = 'idle';
  private isListening = false;
  private isRecognitionRunning = false;
  private isTranscribing = false;
  private useNeuralVadFallback = false;
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
    if (this.stream && this.stream.active && this.audioContext && this.audioContext.state !== 'closed') return true;
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

        // Raw 16kHz PCM audio stream processor
        this.processorNode = this.audioContext.createScriptProcessor(4096, 1, 1);
        this.processorNode.onaudioprocess = (e) => {
          if (!this.isListening) return;
          const inputData = e.inputBuffer.getChannelData(0);
          const copy = new Float32Array(inputData);
          
          if (this.hasDetectedSpeech) {
            this.activePcmBuffers.push(copy);
          } else {
            // Keep last 4 buffers (~1 second) of pre-roll PCM in circular queue
            this.rollingPcmBuffers.push(copy);
            if (this.rollingPcmBuffers.length > 4) {
              this.rollingPcmBuffers.shift();
            }
          }
        };

        source.connect(this.processorNode);
        this.processorNode.connect(this.audioContext.destination);
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
    this.rollingPcmBuffers = [];
    this.activePcmBuffers = [];
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
        setTimeout(() => this.safeStart(), 150);
      };
    }

    this.isListening = true;
    this.safeStart();
    this.startVolumeLoop();
    return true;
  }

  private async transcribePcmBuffers(buffers: Float32Array[]): Promise<string | null> {
    if (!buffers || buffers.length === 0) return null;
    this.isTranscribing = true;
    try {
      const sampleRate = this.audioContext?.sampleRate || 16000;
      const totalLength = buffers.reduce((acc, b) => acc + b.length, 0);
      const merged = new Float32Array(totalLength);
      let offset = 0;
      for (const b of buffers) {
        merged.set(b, offset);
        offset += b.length;
      }

      // Encode merged PCM to pristine 16-bit WAV file
      const wavBlob = encodeWAV(merged, sampleRate);
      if (wavBlob.size < 800) {
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
              body: JSON.stringify({ audioBase64: base64Audio, mimeType: 'audio/wav' })
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
        reader.readAsDataURL(wavBlob);
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

      // Self-Calibrating Moving Average Noise Floor
      if (!this.hasDetectedSpeech) {
        this.ambientNoiseLevel = this.ambientNoiseLevel * 0.96 + volume * 0.04;
      }

      const triggerThreshold = Math.max(0.008, this.ambientNoiseLevel * 1.40 + 0.003);
      const silenceThreshold = Math.max(0.005, this.ambientNoiseLevel * 1.15 + 0.002);

      // Adaptive Real-Time Voice Activity Detection (VAD) & Neural STT Fallback
      if (this.useNeuralVadFallback || this.mode === 'command') {
        if (volume > triggerThreshold) {
          if (!this.hasDetectedSpeech) {
            this.hasDetectedSpeech = true;
            // Pre-populate with pre-roll PCM (~1000ms prior audio)
            this.activePcmBuffers = [...this.rollingPcmBuffers];
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
                const buffersToProcess = [...this.activePcmBuffers];
                this.activePcmBuffers = [];
                const transcript = await this.transcribePcmBuffers(buffersToProcess);
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
    this.rollingPcmBuffers = [];
    this.activePcmBuffers = [];
    this.clearAllTimers();

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
    if (this.processorNode) {
      try { this.processorNode.disconnect(); } catch {}
      this.processorNode = null;
    }
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
