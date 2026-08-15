/**
 * Free On-Device Continuous Speech Wake Word Service (Zero API Keys)
 */

export interface PorcupineServiceOptions {
  onWakeWordDetected?: (keyword: string) => void;
  onError?: (error: Error) => void;
}

export class PorcupineService {
  private recognition: any = null;
  private isListening = false;
  private onWakeWordDetected?: (keyword: string) => void;
  private onError?: (error: Error) => void;

  constructor(options: PorcupineServiceOptions = {}) {
    this.onWakeWordDetected = options.onWakeWordDetected;
    this.onError = options.onError;
  }

  public hasAccessKey(): boolean {
    return true;
  }

  public async start(): Promise<boolean> {
    if (this.isListening) return true;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('[WakeWord] Speech recognition not supported in this environment');
      return false;
    }

    try {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = 'en-US';

      this.recognition.onresult = (event: any) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const text = event.results[i][0].transcript.toLowerCase().trim();
          if (text.includes('hey ahri') || text.includes('hi ahri') || text.includes('okay ahri') || text.includes('ahri')) {
            console.log('[WakeWord] "Hey Ahri" detected via free speech engine');
            if (this.onWakeWordDetected) {
              this.onWakeWordDetected('hey ahri');
            }
            break;
          }
        }
      };

      this.recognition.onerror = (event: any) => {
        if (event.error !== 'no-speech' && event.error !== 'aborted') {
          console.warn('[WakeWord] Recognition notice:', event.error);
        }
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
      this.recognition.start();
      console.log('[WakeWord] Continuous listening active (Free Speech API)');
      return true;
    } catch (err: any) {
      console.warn('[WakeWord] Start failed:', err);
      if (this.onError) {
        this.onError(err);
      }
      return false;
    }
  }

  private restart() {
    if (!this.isListening) return;
    try {
      this.recognition?.start();
    } catch {}
  }

  public async stop() {
    this.isListening = false;
    if (this.recognition) {
      this.recognition.onend = null;
      try {
        this.recognition.stop();
      } catch {}
      this.recognition = null;
    }
  }
}
