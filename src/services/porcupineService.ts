/**
 * PorcupineService — Redirected to MicrophoneManager singleton
 * 
 * The original implementation created a competing SpeechRecognition instance,
 * which broke the single-mic architecture. All wake-word functionality now
 * delegates to MicrophoneManager via WakeWordService.
 */

import { WakeWordService } from '../client/services/wakeWordService';
export { WakeWordService as PorcupineService };
