import { useState, useEffect, useRef, useCallback } from 'react';

// Add TypeScript definitions for Web Speech API
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export type VoiceStatus = 'idle' | 'listening' | 'processing' | 'speaking';

export function useVoice(onTextComplete: (text: string) => void) {
  const [status, setStatus] = useState<VoiceStatus>('idle');
  const [transcript, setTranscript] = useState('');
  const recognitionRef = useRef<any>(null);
  const synthesisRef = useRef<SpeechSynthesis | null>(null);
  const statusRef = useRef<VoiceStatus>('idle');
  const isRecognitionRunningRef = useRef<boolean>(false);

  // Sync status to ref so callbacks always see latest value without re-creating recognition
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  // Mount-only effect: Create SpeechRecognition ONCE, never recreate it
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const rec = new SpeechRecognition();
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = 'en-US';

    rec.onresult = (event: any) => {
      let currentTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        currentTranscript += event.results[i][0].transcript;
      }
      setTranscript(currentTranscript);

      if (event.results[0]?.isFinal) {
        onTextComplete(currentTranscript);
        setStatus('processing');
      }
    };

    rec.onstart = () => {
      isRecognitionRunningRef.current = true;
      setStatus('listening');
      setTranscript('');
    };

    rec.onend = () => {
      isRecognitionRunningRef.current = false;
      // Use ref to check latest status, avoiding stale closure
      if (statusRef.current === 'listening') {
        setStatus('idle');
      }
    };

    rec.onerror = (event: any) => {
      isRecognitionRunningRef.current = false;
      console.error('Speech recognition error', event.error);
      setStatus('idle');
    };

    recognitionRef.current = rec;

    return () => {
      try { rec.stop(); } catch {}
      isRecognitionRunningRef.current = false;
    };
  }, [onTextComplete]); // ← status INTENTIONALLY REMOVED from dependencies

  // Initialize SpeechSynthesis
  useEffect(() => {
    if (typeof window !== 'undefined') {
      synthesisRef.current = window.speechSynthesis;
      if (synthesisRef.current && synthesisRef.current.getVoices) {
        synthesisRef.current.getVoices();
        synthesisRef.current.onvoiceschanged = () => {
          synthesisRef.current?.getVoices();
        };
      }
    }
  }, []);

  const startListening = useCallback(() => {
    if (status === 'speaking' && synthesisRef.current) {
      synthesisRef.current.cancel();
    }
    if (recognitionRef.current) {
      try {
        if (!isRecognitionRunningRef.current) {
          recognitionRef.current.start();
          isRecognitionRunningRef.current = true;
        }
      } catch (e: any) {
        if (e?.name === 'InvalidStateError') {
          isRecognitionRunningRef.current = true;
        } else {
          console.error("Recognition start error:", e);
        }
      }
    }
  }, [status]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
        isRecognitionRunningRef.current = false;
      } catch {}
    }
  }, []);

  const speak = useCallback((text: string) => {
    if (!synthesisRef.current) return;

    setStatus('speaking');
    synthesisRef.current.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    const voices = synthesisRef.current.getVoices();
    const preferredVoice = voices.find(v => 
      v.name.includes('Google US English') || 
      v.name.includes('Samantha') || 
      v.name.includes('Female')
    ) || voices[0];
    
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    utterance.rate = 1.05;
    utterance.pitch = 1.0;

    utterance.onend = () => setStatus('idle');
    utterance.onerror = () => setStatus('idle');

    synthesisRef.current.speak(utterance);
  }, []);

  return {
    status,
    transcript,
    startListening,
    stopListening,
    speak,
    setStatus
  };
}
