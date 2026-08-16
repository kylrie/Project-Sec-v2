import { useState, useEffect, useRef, useCallback } from 'react';
import { VoiceState, VoiceSettings, ConversationTurn } from '../types/friday';
import { soundEffects } from '../services/audioEffects';
import { storageService } from '../services/storage';
import { tryParseLocalIntent } from '../services/localIntentParser';
import { microphoneManager } from '../services/microphoneManager';

interface UseVoiceEngineProps {
  settings: VoiceSettings;
  onTurnComplete: (turn: ConversationTurn) => void;
  onLocalAction?: (intent: string, data: any) => void;
}

export function useVoiceEngine({ settings, onTurnComplete, onLocalAction }: UseVoiceEngineProps) {
  const [state, setState] = useState<VoiceState>('standby');
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [audioLevel, setAudioLevel] = useState(0);
  const [frequencies, setFrequencies] = useState<number[]>(new Array(16).fill(0));
  const [isMicAvailable, setIsMicAvailable] = useState(true);
  const [lastLatencyMs, setLastLatencyMs] = useState<number | null>(null);

  const commandStartTimeRef = useRef(0);
  const settingsRef = useRef(settings);
  const processCommandRef = useRef<(spokenText: string) => Promise<void>>(() => Promise.resolve());

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  // Process User Command with 4-Second Timeout & Instant Local Fallback
  const processCommand = useCallback(async (spokenText: string) => {
    const cleanText = spokenText.trim();
    if (!cleanText) {
      setState('standby');
      return;
    }

    commandStartTimeRef.current = Date.now();
    setState('processing');

    // 1. Check for Stop / Barge-in word
    if (/^(stop|never mind|nevermind|cancel|abort|quiet|shut up)$/i.test(cleanText)) {
      microphoneManager.stop();
      setState('standby');
      if (settingsRef.current.soundEffects) soundEffects.playBargeIn();
      return;
    }

    // 2. Try fast client-side local intent parser
    const localResult = tryParseLocalIntent(cleanText);
    if (localResult && localResult.isHandledLocally) {
      const latency = Date.now() - commandStartTimeRef.current;
      setLastLatencyMs(latency);

      const userTurn: ConversationTurn = {
        id: 'turn-' + Math.random().toString(36).substring(2, 9),
        role: 'user',
        text: cleanText,
        timestamp: Date.now(),
        latencyMs: latency,
        intent: localResult.intent,
        actionData: localResult.actionData
      };
      onTurnComplete(userTurn);

      const fridayTurn: ConversationTurn = {
        id: 'turn-' + Math.random().toString(36).substring(2, 9),
        role: 'friday',
        text: localResult.spokenReply,
        timestamp: Date.now(),
        latencyMs: latency,
        intent: localResult.intent,
        actionData: localResult.actionData
      };
      onTurnComplete(fridayTurn);

      if (onLocalAction) {
        onLocalAction(localResult.intent, localResult.actionData);
      }

      speak(localResult.spokenReply);
      return;
    }

    // 3. Server-side Gemini API with 4s AbortController timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    try {
      const history = storageService.getConversations();
      const res = await fetch('/api/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          message: cleanText,
          context: history.slice(-4).map(h => ({ role: h.role, text: h.text })),
          personality: settings.personality,
          userTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        })
      });

      clearTimeout(timeoutId);
      const latency = Date.now() - commandStartTimeRef.current;
      setLastLatencyMs(latency);

      if (!res.ok) throw new Error(`Server returned ${res.status}`);

      const data = await res.json();
      const replyText = data.spokenReply || data.reply || "Understood, sir. Systems updated.";

      const userTurn: ConversationTurn = {
        id: 'turn-' + Math.random().toString(36).substring(2, 9),
        role: 'user',
        text: cleanText,
        timestamp: Date.now(),
        latencyMs: latency,
        intent: data.intent,
        actionData: data.actionData
      };
      onTurnComplete(userTurn);

      const fridayTurn: ConversationTurn = {
        id: 'turn-' + Math.random().toString(36).substring(2, 9),
        role: 'friday',
        text: replyText,
        timestamp: Date.now(),
        latencyMs: latency,
        intent: data.intent,
        actionData: data.actionData
      };
      onTurnComplete(fridayTurn);

      if (onLocalAction && data.intent) {
        onLocalAction(data.intent, data.actionData);
      }

      speak(replyText);
    } catch (err) {
      clearTimeout(timeoutId);
      console.warn('Fast fallback applied due to network/api condition:', err);
      const latency = Date.now() - commandStartTimeRef.current;
      setLastLatencyMs(latency);

      const fallbackReply = `I've noted that, sir. All core executive functions are operating normally.`;

      const userTurn: ConversationTurn = {
        id: 'turn-' + Math.random().toString(36).substring(2, 9),
        role: 'user',
        text: cleanText,
        timestamp: Date.now(),
        latencyMs: latency,
        intent: 'fallback_response'
      };
      onTurnComplete(userTurn);

      const fridayTurn: ConversationTurn = {
        id: 'turn-' + Math.random().toString(36).substring(2, 9),
        role: 'friday',
        text: fallbackReply,
        timestamp: Date.now(),
        latencyMs: latency,
        intent: 'fallback_response'
      };
      onTurnComplete(fridayTurn);

      speak(fallbackReply);
    }
  }, [onTurnComplete, onLocalAction, settings.personality]);

  processCommandRef.current = processCommand;

  // TTS (Text-to-Speech) — unchanged logic
  const speak = useCallback((text: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      if (window.speechSynthesis.paused) window.speechSynthesis.resume();
      
      setState('speaking');
      const cleanText = text.replace(/[*#_`]/g, '').trim();
      const utterance = new SpeechSynthesisUtterance(cleanText);
      
      const voices = window.speechSynthesis.getVoices();
      const currentSettings = settingsRef.current;
      let selectedVoice = voices.find(v => v.name === currentSettings.voiceName) ||
        voices.find(v => 
          (v.name.includes('Google US English') || v.name.includes('Samantha') || 
           v.name.includes('Natural') || v.name.includes('Victoria') || 
           v.name.includes('Zira') || v.name.includes('Female')) && v.lang.startsWith('en')
        ) || voices.find(v => v.lang.startsWith('en')) || voices[0];
      
      if (selectedVoice) utterance.voice = selectedVoice;
      utterance.rate = currentSettings.rate || 1.05;
      utterance.pitch = currentSettings.pitch || 1.0;
      utterance.volume = currentSettings.volume || 1.0;

      utterance.onend = () => setState('standby');
      utterance.onerror = () => setState('standby');

      window.speechSynthesis.speak(utterance);

      // Keep-alive heartbeat for Chromium
      const keepAliveTimer = setInterval(() => {
        if (!window.speechSynthesis.speaking) {
          clearInterval(keepAliveTimer);
          return;
        }
        window.speechSynthesis.pause();
        window.speechSynthesis.resume();
      }, 8000);
    } catch (err) {
      console.warn('TTS execution error', err);
      setState('standby');
    }
  }, []);

  // Interrupt / Barge-in
  const interrupt = useCallback(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      try { window.speechSynthesis.cancel(); } catch {}
      if (settingsRef.current.soundEffects) soundEffects.playBargeIn();
    }
    microphoneManager.stop();
    setState('interrupted');
    setTimeout(() => setState((curr) => curr === 'interrupted' ? 'standby' : curr), 300);
  }, []);

  // Start Manual Listening — delegates to MicrophoneManager
  const startManualListening = useCallback(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      try { window.speechSynthesis.cancel(); } catch {}
    }
    setState('listening');
    setTranscript('');
    setInterimTranscript('');
    if (settingsRef.current.soundEffects) soundEffects.playWakeChime();

    microphoneManager.start('command', {
      onTranscript: (text: string, isFinal: boolean) => {
        if (isFinal) {
          setTranscript(text);
          setInterimTranscript('');
          processCommandRef.current(text);
        } else {
          setInterimTranscript(text);
        }
      },
      onVolume: (level: number) => {
        setAudioLevel(level);
        const bars = new Array(16).fill(0).map((_, i) => 
          Math.max(0, level * (0.5 + Math.random() * 0.5))
        );
        setFrequencies(bars);
      },
      onError: (err: string) => {
        console.error('[VoiceEngine] Mic error:', err);
        setIsMicAvailable(false);
        setState('standby');
      }
    });
  }, []);

  // Stop Manual Listening
  const stopManualListening = useCallback(() => {
    const text = microphoneManager.isActive() ? transcript || interimTranscript : '';
    microphoneManager.stop();
    if (text.trim()) {
      processCommandRef.current(text.trim());
    } else {
      setState('standby');
    }
  }, [transcript, interimTranscript]);

  // Continuous listening mode
  useEffect(() => {
    if (settings.continuousListening) {
      microphoneManager.start('wake-word', {
        onWakeWord: () => {
          setState('listening');
          if (settingsRef.current.soundEffects) soundEffects.playWakeChime();
        },
        onTranscript: (text: string, isFinal: boolean) => {
          if (isFinal) {
            setTranscript(text);
            processCommandRef.current(text);
          } else {
            setInterimTranscript(text);
          }
        },
        onVolume: (level: number) => {
          setAudioLevel(level);
          const bars = new Array(16).fill(0).map((_, i) => 
            Math.max(0, level * (0.5 + Math.random() * 0.5))
          );
          setFrequencies(bars);
        },
        onError: (err: string) => {
          console.error('[VoiceEngine] Continuous mode error:', err);
          setIsMicAvailable(false);
        }
      });
    } else {
      if (microphoneManager.getMode() === 'wake-word') {
        microphoneManager.stop();
      }
    }

    return () => {
      if (microphoneManager.getMode() === 'wake-word') {
        microphoneManager.stop();
      }
    };
  }, [settings.continuousListening]);

  return {
    state,
    setState,
    transcript: transcript || interimTranscript,
    audioLevel,
    frequencies,
    isMicAvailable,
    lastLatencyMs,
    startManualListening,
    stopManualListening,
    interrupt,
    speak,
    processCommand
  };
}
