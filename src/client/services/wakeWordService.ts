import { PorcupineWorker, BuiltInKeyword, PorcupineDetection } from '@picovoice/porcupine-web';
import { WebVoiceProcessor } from '@picovoice/web-voice-processor';

export interface WakeWordCallbacks {
  onWakeWordDetected: () => void;
  onListeningStart: () => void;
  onListeningEnd: () => void;
  onTranscript: (text: string) => void;
  onError: (error: string) => void;
}

export class WakeWordService {
  private porcupine: any = null;
  private webVp: any = null;
  private isListening = false;
  private silenceTimeout: ReturnType<typeof setTimeout> | null = null;
  private recognition: any = null;
  private callbacks: WakeWordCallbacks;

  constructor(callbacks: WakeWordCallbacks) {
    this.callbacks = callbacks;
  }

  async initialize(accessKey: string) {
    try {
      this.porcupine = await PorcupineWorker.create(
        accessKey,
        [BuiltInKeyword.Jarvis, BuiltInKeyword.Porcupine],
        this.porcupineCallback,
        {
          processErrorCallback: (error: Error) => {
            console.warn('[WakeWord] Porcupine internal error:', error);
            this.callbacks.onError(error.message);
          }
        }
      );
      
      await WebVoiceProcessor.subscribe(this.porcupine);
      console.log('[WakeWord] Porcupine initialized and subscribed to WebVoiceProcessor');
    } catch (err: any) {
      console.error('[WakeWord] Init failed:', err);
      this.callbacks.onError(err?.message || 'Wake word engine failed to start');
    }
  }

  private porcupineCallback = (detection: PorcupineDetection) => {
    console.log('[WakeWord] "Hey Ahri" / keyword detected:', detection.label || detection.index);
    this.callbacks.onWakeWordDetected();
    this.startSpeechRecognition();
  };


  private startSpeechRecognition() {
    if (this.isListening) return;
    this.isListening = true;
    this.callbacks.onListeningStart();

    // Use Web Speech API for STT after wake word
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      this.callbacks.onError('Speech recognition not supported');
      this.stopListening();
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-US';

    let finalTranscript = '';

    this.recognition.onresult = (event: any) => {
      let interimTranscript = '';
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      // Reset silence timer on any speech
      this.resetSilenceTimer();

      // If we have a final transcript, process it
      if (finalTranscript.trim().length > 0 && interimTranscript === '') {
        this.callbacks.onTranscript(finalTranscript.trim());
        this.stopListening();
      }
    };

    this.recognition.onerror = (event: any) => {
      if (event.error !== 'no-speech') {
        console.error('[WakeWord] STT error:', event.error);
        this.callbacks.onError(event.error);
      }
      this.stopListening();
    };

    this.recognition.onend = () => {
      if (this.isListening && finalTranscript.trim().length === 0) {
        // If ended prematurely with no transcript, restart briefly
        this.resetSilenceTimer();
      }
    };

    try {
      this.recognition.start();
    } catch {
      // already active
    }
    this.resetSilenceTimer();
  }

  private resetSilenceTimer() {
    if (this.silenceTimeout) clearTimeout(this.silenceTimeout);
    this.silenceTimeout = setTimeout(() => {
      console.log('[WakeWord] Silence detected, stopping...');
      this.stopListening();
    }, 2000); // 2 seconds of silence = stop
  }

  stopListening() {
    this.isListening = false;
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {}
      this.recognition = null;
    }
    if (this.silenceTimeout) {
      clearTimeout(this.silenceTimeout);
      this.silenceTimeout = null;
    }
    this.callbacks.onListeningEnd();
  }

  async start() {
    if (this.porcupine) {
      await WebVoiceProcessor.subscribe(this.porcupine);
      console.log('[WakeWord] Listening for "Hey Ahri"...');
    }
  }

  async stop() {
    this.stopListening();
    if (this.porcupine) {
      try {
        await WebVoiceProcessor.unsubscribe(this.porcupine);
        this.porcupine.terminate();
      } catch (e) {
        console.warn('[WakeWord] Stop exception:', e);
      }
      this.porcupine = null;
    }
  }
}

export default WakeWordService;
