import { microphoneManager } from '../../services/microphoneManager';

export interface WakeWordServiceOptions {
  onWakeWordDetected?: (keyword: string) => void;
  onListeningStart?: () => void;
  onListeningEnd?: () => void;
  onTranscript?: (text: string) => void;
  onError?: (error: any) => void;
}

export class WakeWordService {
  private options: WakeWordServiceOptions;
  private isActive = false;

  constructor(options: WakeWordServiceOptions = {}) {
    this.options = options;
  }

  async initialize(): Promise<boolean> {
    console.log('[WakeWord] Delegated to MicrophoneManager');
    return true;
  }

  async start(): Promise<boolean> {
    if (this.isActive) return true;
    
    const started = await microphoneManager.start('wake-word', {
      onWakeWord: () => {
        this.options.onWakeWordDetected?.('hey ahri');
        this.options.onListeningStart?.();
      },
      onTranscript: (text: string, isFinal: boolean) => {
        if (isFinal && text.length > 3) {
          this.options.onTranscript?.(text);
          this.options.onListeningEnd?.();
        }
      },
      onError: (err: string) => {
        this.options.onError?.(new Error(err));
      }
    });

    if (started) {
      this.isActive = true;
      console.log('[WakeWord] Listening via MicrophoneManager');
    }
    return started;
  }

  stop() {
    this.isActive = false;
    if (microphoneManager.getMode() === 'wake-word') {
      microphoneManager.stop();
    }
  }
}

export default WakeWordService;
