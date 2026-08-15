import { useEffect, useRef, useState, useCallback } from 'react';
import { WakeWordService } from '../services/wakeWordService';
import { apiPost } from '../services/apiClient';
import { useActionBroker } from './useActionBroker';

export function useWakeWord() {
  const [isListening, setIsListening] = useState(false);
  const [isWakeWordActive, setIsWakeWordActive] = useState(false);
  const [transcript, setTranscript] = useState('');
  const serviceRef = useRef<WakeWordService | null>(null);
  const initializedRef = useRef(false); // BUG 3 FIX: Guard against double-init
  const { processCommand, pendingAction, isConfirming, confirmAction, cancelAction } = useActionBroker();

  // BUG 3 FIX: Use a ref for the transcript handler so it never changes identity
  const handleTranscriptRef = useRef<(text: string) => void>(() => {});

  // Keep the ref always pointing to the latest handler logic
  handleTranscriptRef.current = async (text: string) => {
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
  };

  // BUG 3 FIX: Initialize only ONCE — empty dependency array, stable callback via ref
  useEffect(() => {
    if (initializedRef.current) return; // Guard re-entry
    initializedRef.current = true;

    serviceRef.current = new WakeWordService({
      onWakeWordDetected: () => {
        console.log('Wake word detected!');
        playChime();
      },
      onListeningStart: () => setIsListening(true),
      onListeningEnd: () => setIsListening(false),
      onTranscript: (text: string) => handleTranscriptRef.current(text), // Stable wrapper
      onError: (err: any) => console.error('Wake word error:', err),
    });

    serviceRef.current.initialize().then(() => {
      // Ready
    });

    return () => {
      serviceRef.current?.stop();
      serviceRef.current = null;
      initializedRef.current = false;
      setIsWakeWordActive(false);
    };
  }, []); // BUG 3 FIX: Empty deps — never re-creates the service

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
