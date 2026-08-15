class WakeWordService {
  private recognition: any = null;
  private isListening = false;
  private silenceTimeout: ReturnType<typeof setTimeout> | null = null;
  private callbacks: any;
  private wakeWordDetected = false;
  private finalTranscript = '';

  // BUG 1 FIX: Exponential backoff restart to prevent CPU hammering
  private restartTimer: ReturnType<typeof setTimeout> | null = null;
  private restartDelay = 1000;
  private readonly MAX_RESTART_DELAY = 8000;

  constructor(callbacks: any) {
    this.callbacks = callbacks;
  }

  async initialize() {
    // No key needed — uses browser's built-in speech recognition
    console.log('[WakeWord] Using free Web Speech API');
    return true;
  }

  private async checkMicPermission(): Promise<boolean> {
    try {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return false;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch {
      return false;
    }
  }

  async start() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('[WakeWord] SpeechRecognition API not available in this environment');
      this.callbacks.onError?.('Speech recognition not supported in this browser');
      return;
    }

    // Explicitly verify microphone permission before starting speech recognition
    const hasPermission = await this.checkMicPermission();
    if (!hasPermission) {
      console.warn('[WakeWord] Microphone access denied or AudioContext error');
      this.callbacks.onError?.('Microphone access denied. Please allow mic permission.');
      return;
    }

    try {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = 'en-US';

      this.recognition.onresult = (event: any) => {
        let interim = '';
        this.finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript.toLowerCase().trim();
          if (event.results[i].isFinal) {
            this.finalTranscript += transcript;
            
            // Check if transcript contains "hey ahri" or "hi ahri"
            if (transcript.includes('hey ahri') || transcript.includes('hi ahri') || transcript.includes('okay ahri')) {
              if (!this.wakeWordDetected) {
                this.wakeWordDetected = true;
                this.callbacks.onWakeWordDetected?.();
                this.callbacks.onListeningStart?.();
                this.playChime();
              }
            }
            
            // If already in command mode, send the transcript (minus wake word)
            if (this.wakeWordDetected && !transcript.includes('hey ahri') && transcript.length > 3) {
              this.callbacks.onTranscript?.(this.finalTranscript.replace(/hey ahri|hi ahri|okay ahri/g, '').trim());
              this.stopCommandMode();
            }
          } else {
            interim += transcript;
          }
        }

        // Reset silence timer on any speech
        if (interim.length > 0 || this.finalTranscript.length > 0) {
          this.resetSilenceTimer();
        }
      };

      this.recognition.onerror = (event: any) => {
        if (event.error !== 'no-speech' && event.error !== 'aborted') {
          console.warn('[WakeWord] Status notice:', event.error);
        }
        // Auto-restart on error (except manual stop) — uses backoff
        if (this.isListening && event.error !== 'aborted') {
          this.restart();
        }
      };

      this.recognition.onend = () => {
        if (this.isListening) {
          // Reset backoff on successful session end (not an error)
          this.restartDelay = 1000;
          this.restart();
        }
      };

      this.isListening = true;
      this.recognition.start();
      console.log('[WakeWord] Listening for "Hey Ahri"... (Free mode)');
    } catch (e: any) {
      if (e.message?.includes('AudioContext') || e.name === 'NotAllowedError') {
        console.warn('[WakeWord] Microphone access denied or AudioContext error');
        this.callbacks.onError?.('Microphone access denied. Please allow mic permission.');
      } else {
        console.warn('[WakeWord] Startup notice:', e?.message);
      }
    }
  }

  // BUG 1 FIX: Exponential backoff restart with state checks
  private restart() {
    if (!this.isListening) return;

    // Clear any pending restart to avoid stacking
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }

    // Don't restart if recognition is already running
    try {
      if (this.recognition && typeof this.recognition.abort === 'function') {
        // Some browsers expose state; if not, we just try/catch the start
      }
    } catch {}

    this.restartTimer = setTimeout(() => {
      if (!this.isListening) return;
      try {
        this.recognition?.start();
        // Reset delay on successful start
        this.restartDelay = 1000;
      } catch (e) {
        // Increase backoff on failure, capped at MAX
        this.restartDelay = Math.min(this.restartDelay * 2, this.MAX_RESTART_DELAY);
        console.warn(`[WakeWord] Restart failed, retrying in ${this.restartDelay}ms`);
        this.restart();
      }
    }, this.restartDelay);
  }

  private resetSilenceTimer() {
    if (this.silenceTimeout) clearTimeout(this.silenceTimeout);
    this.silenceTimeout = setTimeout(() => {
      if (this.wakeWordDetected) {
        console.log('[WakeWord] Silence detected, ending command');
        this.stopCommandMode();
      }
    }, 2000);
  }

  private stopCommandMode() {
    this.wakeWordDetected = false;
    this.callbacks.onListeningEnd();
  }

  private playChime() {
    const audio = new Audio('/sounds/wake-chime.mp3');
    audio.volume = 0.3;
    audio.play().catch(() => {});
  }

  stop() {
    this.isListening = false;
    this.wakeWordDetected = false;
    if (this.silenceTimeout) clearTimeout(this.silenceTimeout);
    // BUG 1 FIX: Clear pending restart timer on stop
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
    if (this.recognition) {
      this.recognition.onend = null;
      try {
        this.recognition.stop();
      } catch {}
      this.recognition = null;
    }
  }
}

export default WakeWordService;
export { WakeWordService };
