import { microphoneManager } from './microphoneManager';

export interface PorcupineServiceOptions {
  onWakeWordDetected?: (keyword: string) => void;
  onError?: (error: Error) => void;
}

export class PorcupineService {
  private onWakeWordDetected?: (keyword: string) => void;
  private onError?: (error: Error) => void;
  private isListening = false;

  constructor(options: PorcupineServiceOptions = {}) {
    this.onWakeWordDetected = options.onWakeWordDetected;
    this.onError = options.onError;
  }

  public hasAccessKey(): boolean {
    return true;
  }

  public async start(): Promise<boolean> {
    if (this.isListening) return true;

    const started = await microphoneManager.start('wake-word', {
      onWakeWord: () => {
        this.onWakeWordDetected?.('hey ahri');
      },
      onError: (err: string) => {
        this.onError?.(new Error(err));
      }
    });

    if (started) {
      this.isListening = true;
    }
    return started;
  }

  public async stop() {
    this.isListening = false;
    if (microphoneManager.getMode() === 'wake-word') {
      microphoneManager.stop();
    }
  }
}
