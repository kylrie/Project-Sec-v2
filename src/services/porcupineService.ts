/**
 * Picovoice Porcupine Wake Word Service
 * On-device local wake word detection with graceful fallback.
 */

import { PorcupineWorker, BuiltInKeyword, PorcupineDetection } from '@picovoice/porcupine-web';
import { WebVoiceProcessor } from '@picovoice/web-voice-processor';

export interface PorcupineServiceOptions {
  accessKey?: string;
  onWakeWordDetected?: (keyword: string) => void;
  onError?: (error: Error) => void;
}

export class PorcupineService {
  private porcupineWorker: PorcupineWorker | null = null;
  private accessKey: string | null = null;
  private isListening = false;
  private onWakeWordDetected?: (keyword: string) => void;
  private onError?: (error: Error) => void;

  constructor(options: PorcupineServiceOptions = {}) {
    this.accessKey = options.accessKey || (import.meta as any).env?.VITE_PICOVOICE_ACCESS_KEY || null;
    this.onWakeWordDetected = options.onWakeWordDetected;
    this.onError = options.onError;
  }

  /**
   * Check if Picovoice access key is configured
   */
  public hasAccessKey(): boolean {
    return Boolean(this.accessKey && this.accessKey.trim().length > 10);
  }

  /**
   * Start local on-device wake word listening
   */
  public async start(): Promise<boolean> {
    if (this.isListening) return true;

    if (!this.hasAccessKey()) {
      console.log('[Porcupine] No Picovoice access key provided. Falling back to browser speech continuous recognition.');
      return false;
    }

    try {
      this.porcupineWorker = await PorcupineWorker.create(
        this.accessKey!,
        [BuiltInKeyword.Jarvis, BuiltInKeyword.Porcupine],
        (detection: PorcupineDetection) => {
          const keywordLabel = detection.label || `${detection.index}`;
          console.log(`[Porcupine] Wake word detected: ${keywordLabel}`);
          if (this.onWakeWordDetected) {
            this.onWakeWordDetected(keywordLabel);
          }
        },
        {
          processErrorCallback: (error: Error) => {
            console.warn('[Porcupine] Worker error:', error);
            if (this.onError) {
              this.onError(error);
            }
          }
        }
      );


      await WebVoiceProcessor.subscribe(this.porcupineWorker);
      this.isListening = true;
      console.log('[Porcupine] On-device wake word engine active');
      return true;
    } catch (err: any) {
      console.warn('[Porcupine] Initialization failed, using browser speech fallback:', err?.message || err);
      if (this.onError) {
        this.onError(err);
      }
      return false;
    }
  }

  /**
   * Pause / stop wake word listening (e.g. while Ahri is speaking or listening to user command)
   */
  public async stop() {
    if (!this.isListening) return;

    try {
      if (this.porcupineWorker) {
        await WebVoiceProcessor.unsubscribe(this.porcupineWorker);
        this.porcupineWorker.terminate();
        this.porcupineWorker = null;
      }
    } catch (err) {
      console.warn('[Porcupine] Stop exception:', err);
    } finally {
      this.isListening = false;
    }
  }
}
