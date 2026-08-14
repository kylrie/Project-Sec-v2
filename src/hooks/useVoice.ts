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

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = false;
        recognitionRef.current.interimResults = true;
        recognitionRef.current.lang = 'en-US';

        recognitionRef.current.onresult = (event: any) => {
          let currentTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            currentTranscript += event.results[i][0].transcript;
          }
          setTranscript(currentTranscript);
          
          if (event.results[0].isFinal) {
            onTextComplete(currentTranscript);
            setStatus('processing');
          }
        };

        recognitionRef.current.onstart = () => {
          setStatus('listening');
          setTranscript('');
        };

        recognitionRef.current.onend = () => {
          if (status === 'listening') {
            setStatus('idle');
          }
        };

        recognitionRef.current.onerror = (event: any) => {
          console.error('Speech recognition error', event.error);
          setStatus('idle');
        };
      }
      
      synthesisRef.current = window.speechSynthesis;
    }
  }, [onTextComplete, status]);

  const startListening = useCallback(() => {
    if (status === 'speaking' && synthesisRef.current) {
      synthesisRef.current.cancel(); // Interrupt FRIDAY
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
      } catch (e) {
        console.error("Recognition already started");
      }
    }
  }, [status]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  }, []);

  const speak = useCallback((text: string) => {
    if (!synthesisRef.current) return;
    
    setStatus('speaking');
    synthesisRef.current.cancel(); // Cancel any ongoing speech
    
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Try to find a good female voice for FRIDAY
    const voices = synthesisRef.current.getVoices();
    const preferredVoice = voices.find(v => v.name.includes('Google US English') || v.name.includes('Samantha') || v.name.includes('Female')) || voices[0];
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }
    
    utterance.rate = 1.05; // Slightly faster for efficiency
    utterance.pitch = 1.0;
    
    utterance.onend = () => {
      setStatus('idle');
    };
    
    utterance.onerror = () => {
      setStatus('idle');
    };

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
