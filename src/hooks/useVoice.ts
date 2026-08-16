import { useState, useEffect, useCallback } from 'react';
import { microphoneManager } from '../services/microphoneManager';

export type VoiceStatus = 'idle' | 'listening' | 'processing' | 'speaking';

export function useVoice(onTextComplete: (text: string) => void) {
  const [status, setStatus] = useState<VoiceStatus>('idle');
  const [transcript, setTranscript] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis?.getVoices) {
      window.speechSynthesis.getVoices();
    }
  }, []);

  const startListening = useCallback(() => {
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
      onError: (err: string) => { console.error(err); setStatus('idle'); }
    });
  }, [onTextComplete]);

  const stopListening = useCallback(() => {
    microphoneManager.stop();
    setStatus('idle');
  }, []);

  const speak = useCallback((text: string) => {
    if (!window.speechSynthesis) return;
    setStatus('speaking');
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    const v = voices.find(x => /Google US English|Samantha|Female/.test(x.name)) || voices[0];
    if (v) u.voice = v;
    u.rate = 1.05; u.pitch = 1.0;
    u.onend = () => setStatus('idle');
    u.onerror = () => setStatus('idle');
    window.speechSynthesis.speak(u);
  }, []);

  return { status, transcript, startListening, stopListening, speak, setStatus };
}
