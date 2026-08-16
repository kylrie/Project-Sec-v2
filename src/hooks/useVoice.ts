import { useState, useEffect, useCallback, useRef } from 'react';
import { microphoneManager } from '../services/microphoneManager';

export type VoiceStatus = 'idle' | 'listening' | 'processing' | 'speaking';

export function useVoice(onTextComplete: (text: string) => void) {
  const [status, setStatus] = useState<VoiceStatus>('idle');
  const [transcript, setTranscript] = useState('');
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis?.getVoices) {
      window.speechSynthesis.getVoices();
    }
  }, []);

  const startListening = useCallback(() => {
    if (activeAudioRef.current) {
      try {
        activeAudioRef.current.pause();
        activeAudioRef.current.currentTime = 0;
      } catch {}
      activeAudioRef.current = null;
    }
    setStatus('listening');
    setTranscript('');
    microphoneManager.start('command', {
      onTranscript: (text: string, isFinal: boolean) => {
        setTranscript(text);
        if (isFinal && text.trim()) {
          onTextComplete(text.trim());
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
    const clean = text.replace(/[*#_`]/g, '').trim();
    if (!clean) return;

    if (activeAudioRef.current) {
      try {
        activeAudioRef.current.pause();
        activeAudioRef.current.currentTime = 0;
      } catch {}
      activeAudioRef.current = null;
    }

    setStatus('speaking');

    try {
      const audio = new Audio(`/api/tts?text=${encodeURIComponent(clean)}`);
      activeAudioRef.current = audio;
      audio.playbackRate = 1.04;
      audio.onended = () => {
        activeAudioRef.current = null;
        setStatus('idle');
      };
      audio.onerror = () => {
        activeAudioRef.current = null;
        fallbackSpeak(clean);
      };
      audio.play().catch(() => fallbackSpeak(clean));
    } catch {
      fallbackSpeak(clean);
    }

    function fallbackSpeak(t: string) {
      if (!window.speechSynthesis) {
        setStatus('idle');
        return;
      }
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(t);
      const voices = window.speechSynthesis.getVoices();
      const v = voices.find(x => /Google|Natural|Jenny|Aria|Samantha|Female/i.test(x.name)) || voices[0];
      if (v) u.voice = v;
      u.rate = 1.05; u.pitch = 1.0;
      u.onend = () => setStatus('idle');
      u.onerror = () => setStatus('idle');
      window.speechSynthesis.speak(u);
    }
  }, []);

  return { status, transcript, startListening, stopListening, speak, setStatus };
}
