import { useEffect, useRef, useState, useCallback } from 'react';
import { WakeWordService } from '../services/wakeWordService';
import { apiPost } from '../services/apiClient';
import { useActionBroker } from './useActionBroker';

export function useWakeWord() {
  const [isListening, setIsListening] = useState(false);
  const [isWakeWordActive, setIsWakeWordActive] = useState(false);
  const [transcript, setTranscript] = useState('');
  const serviceRef = useRef<WakeWordService | null>(null);
  const { processCommand, pendingAction, isConfirming, confirmAction, cancelAction } = useActionBroker();

  const handleTranscript = useCallback(async (text: string) => {
    setTranscript(text);
    setIsListening(false);
    
    // Step 1: First, check if this is an executive action (food, ride, money, booking)
    const actionResult = await processCommand(text);
    if (actionResult && actionResult.requiresConfirmation) {
      return; // Pause speech and show confirmation modal
    }

    // Step 2: If not an action, send to normal AI brain
    try {
      const result = await apiPost<{ spokenReply?: string }>('/api/command', {
        message: text,
        sessionId: 'voice-session',
        personality: 'professional',
        userTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      
      // Play spoken reply via TTS
      if (result && result.spokenReply) {
        speakText(result.spokenReply);
      }
    } catch (err) {
      console.error('Command failed:', err);
    }
  }, [processCommand]);

  useEffect(() => {
    serviceRef.current = new WakeWordService({
      onWakeWordDetected: () => {
        console.log('Wake word detected!');
        playChime();
      },
      onListeningStart: () => setIsListening(true),
      onListeningEnd: () => setIsListening(false),
      onTranscript: handleTranscript,
      onError: (err: any) => console.error('Wake word error:', err),
    });

    serviceRef.current.initialize().then(() => {
      // Ready
    });

    return () => {
      serviceRef.current?.stop();
      setIsWakeWordActive(false);
    };
  }, [handleTranscript]);

  const toggleWakeWord = useCallback(() => {
    if (isWakeWordActive) {
      serviceRef.current?.stop();
      setIsWakeWordActive(false);
    } else {
      serviceRef.current?.start();
      setIsWakeWordActive(true);
    }
  }, [isWakeWordActive]);

  return {
    isListening,
    isWakeWordActive,
    transcript,
    toggleWakeWord,
    pendingAction,
    isConfirming,
    confirmAction,
    cancelAction
  };
}

function playChime() {
  try {
    const audio = new Audio('/sounds/wake-chime.mp3');
    audio.volume = 0.3;
    audio.play().catch(() => {});
  } catch {}
}

function speakText(text: string) {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
  }
}

export default useWakeWord;
