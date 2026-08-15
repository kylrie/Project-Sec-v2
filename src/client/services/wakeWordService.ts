class WakeWordService {
  private recognition: any = null;
  private isListening = false;
  private silenceTimeout: ReturnType<typeof setTimeout> | null = null;
  private callbacks: any;
  private wakeWordDetected = false;
  private finalTranscript = '';

  constructor(callbacks: any) {
    this.callbacks = callbacks;
  }

  async initialize() {
    // No key needed — uses browser's built-in speech recognition
    console.log('[WakeWord] Using free Web Speech API');
    return true;
  }

  async start() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      this.callbacks.onError('Speech recognition not supported in this browser');
      return;
    }

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
              this.callbacks.onWakeWordDetected();
              this.callbacks.onListeningStart();
              this.playChime();
            }
          }
          
          // If already in command mode, send the transcript (minus wake word)
          if (this.wakeWordDetected && !transcript.includes('hey ahri') && transcript.length > 3) {
            this.callbacks.onTranscript(this.finalTranscript.replace(/hey ahri|hi ahri|okay ahri/g, '').trim());
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
        console.error('[WakeWord] Error:', event.error);
      }
      // Auto-restart on error (except manual stop)
      if (this.isListening && event.error !== 'aborted') {
        setTimeout(() => this.restart(), 500);
      }
    };

    this.recognition.onend = () => {
      if (this.isListening) {
        this.restart();
      }
    };

    this.isListening = true;
    try {
      this.recognition.start();
    } catch {}
    console.log('[WakeWord] Listening for "Hey Ahri"... (Free mode)');
  }

  private restart() {
    if (!this.isListening) return;
    try {
      this.recognition?.start();
    } catch (e) {
      setTimeout(() => this.restart(), 300);
    }
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
