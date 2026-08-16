import { useState, useEffect, useRef, useCallback } from 'react';
import { microphoneManager } from '../services/microphoneManager';

export type VoiceStatus = 'idle' | 'listening' | 'processing' | 'speaking';

export function useVoice(onTextComplete: (text: string) => void) {
  const [status, setStatus] = useState<VoiceStatus>('idle');
  const [transcript, setTranscript] = useState('');
  const synthesisRef = useRef<SpeechSynthesis | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      synthesisRef.current = window.speechSynthesis;
      if (synthesisRef.current?.getVoices) {
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
    
    setStatus('listening');
    setTranscript('');
    
    microphoneManager.start('command', {
      onTranscript: (text: string, isFinal: boolean) => {
        setTranscript(text);
        if (isFinal) {
          onTextComplete(text);
          setStatus('processing');
          microphoneManager.stop();
        }
      },
      onError: (err: string) => {
        console.error('Speech recognition error:', err);
        setStatus('idle');
      }
    });
  }, [onTextComplete, status]);

  const stopListening = useCallback(() => {
    microphoneManager.stop();
    setStatus('idle');
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
    
    if (preferredVoice) utterance.voice = preferredVoice;
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
