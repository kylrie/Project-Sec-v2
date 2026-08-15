/**
 * Voice Activity Detection (VAD) Service
 * Real-time audio energy and silence detection with 1.5s automatic cutoff.
 */

export interface VADOptions {
  silenceTimeoutMs?: number; // Duration of silence to trigger speech end (default: 1500ms)
  energyThreshold?: number;  // RMS audio energy threshold to consider as speech (default: 0.025)
  onSpeechStart?: () => void;
  onSpeechEnd?: (durationMs: number) => void;
  onAudioLevel?: (level: number) => void;
}

export class VADService {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private animFrameId: number | null = null;
  
  private isSpeaking = false;
  private speechStartTime = 0;
  private lastSpeechTime = 0;
  private silenceTimer: any = null;
  
  private silenceTimeoutMs: number;
  private energyThreshold: number;
  private onSpeechStart?: () => void;
  private onSpeechEnd?: (durationMs: number) => void;
  private onAudioLevel?: (level: number) => void;

  constructor(options: VADOptions = {}) {
    this.silenceTimeoutMs = options.silenceTimeoutMs ?? 1500;
    this.energyThreshold = options.energyThreshold ?? 0.025;
    this.onSpeechStart = options.onSpeechStart;
    this.onSpeechEnd = options.onSpeechEnd;
    this.onAudioLevel = options.onAudioLevel;
  }

  /**
   * Start VAD monitoring on an existing MediaStream
   */
  public start(stream: MediaStream, existingAudioContext?: AudioContext) {
    this.stop();

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = existingAudioContext || new AudioCtx();
      
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume().catch(() => {});
      }

      this.source = this.audioContext.createMediaStreamSource(stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.5;
      this.source.connect(this.analyser);

      const bufferLength = this.analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const checkAudioLevel = () => {
        if (!this.analyser) return;

        this.analyser.getByteTimeDomainData(dataArray);

        // Compute RMS energy
        let sumSquares = 0;
        for (let i = 0; i < bufferLength; i++) {
          const normalized = (dataArray[i] - 128) / 128;
          sumSquares += normalized * normalized;
        }
        const rms = Math.sqrt(sumSquares / bufferLength);

        if (this.onAudioLevel) {
          this.onAudioLevel(rms);
        }

        const now = Date.now();

        if (rms > this.energyThreshold) {
          this.lastSpeechTime = now;

          if (!this.isSpeaking) {
            this.isSpeaking = true;
            this.speechStartTime = now;
            if (this.onSpeechStart) {
              this.onSpeechStart();
            }
          }

          // Clear any pending silence timeout while active voice is detected
          if (this.silenceTimer) {
            clearTimeout(this.silenceTimer);
            this.silenceTimer = null;
          }
        } else if (this.isSpeaking) {
          // Voice was active, now silent — check if 1.5s silence elapsed
          if (!this.silenceTimer) {
            this.silenceTimer = setTimeout(() => {
              if (this.isSpeaking) {
                this.isSpeaking = false;
                const totalDuration = Date.now() - this.speechStartTime;
                if (this.onSpeechEnd) {
                  this.onSpeechEnd(totalDuration);
                }
              }
              this.silenceTimer = null;
            }, this.silenceTimeoutMs);
          }
        }

        this.animFrameId = requestAnimationFrame(checkAudioLevel);
      };

      this.animFrameId = requestAnimationFrame(checkAudioLevel);
    } catch (err) {
      console.warn('[VAD] Initialization exception:', err);
    }
  }

  /**
   * Stop VAD processing and clear timers
   */
  public stop() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
    if (this.source) {
      try {
        this.source.disconnect();
      } catch {}
      this.source = null;
    }
    this.analyser = null;
    this.isSpeaking = false;
  }
}
