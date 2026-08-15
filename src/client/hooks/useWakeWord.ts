import { useEffect, useRef, useState, useCallback } from 'react';
import { WakeWordService } from '../services/wakeWordService';
import { apiPost } from '../services/apiClient';

export function useWakeWord() {
  const [isListening, setIsListening] = useState(false);
  const [isWakeWordActive, setIsWakeWordActive] = useState(false);
  const [transcript, setTranscript] = useState('');
  const serviceRef = useRef<WakeWordService | null>(null);

  const handleTranscript = useCallback(async (text: string) => {
    setTranscript(text);
    setIsListening(false);
    
    // Auto-send to AI
    try {
      const result = await apiPost('/api/command', {
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
  }, []);

  useEffect(() => {
    const accessKey = (import.meta as any).env?.VITE_PICOVOICE_ACCESS_KEY;
    if (!accessKey) {
      console.warn('[useWakeWord] No Picovoice access key configured');
      return;
    }

    serviceRef.current = new WakeWordService({
      onWakeWordDetected: () => {
        console.log('Wake word detected!');
        playChime();
      },
      onListeningStart: () => setIsListening(true),
      onListeningEnd: () => setIsListening(false),
      onTranscript: handleTranscript,
      onError: (err) => console.error('Wake word error:', err),
    });

    serviceRef.current.initialize(accessKey).then(() => {
      serviceRef.current?.start();
      setIsWakeWordActive(true);
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

  return { isListening, isWakeWordActive, transcript, toggleWakeWord };
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
