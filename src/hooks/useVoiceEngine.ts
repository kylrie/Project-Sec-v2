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
  const [frequencies, setFrequencies] = useState(new Array(16).fill(0));
  const [isMicAvailable, setIsMicAvailable] = useState(true);
  const [lastLatencyMs, setLastLatencyMs] = useState<number | null>(null);

  const commandStartTimeRef = useRef(0);
  const settingsRef = useRef(settings);
  const processCommandRef = useRef<(text: string) => Promise<void>>(() => Promise.resolve());
  const shouldRestartWakeWord = useRef(false);

  useEffect(() => { settingsRef.current = settings; }, [settings]);

  const speak = useCallback((text: string) => {
    if (!window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      if (window.speechSynthesis.paused) window.speechSynthesis.resume();
      setState('speaking');
      const u = new SpeechSynthesisUtterance(text.replace(/[*#_`]/g, '').trim());
      const voices = window.speechSynthesis.getVoices();
      const s = settingsRef.current;
      const v = voices.find(x => x.name === s.voiceName) ||
        voices.find(x => /Google US English|Samantha|Natural|Victoria|Zira|Female/.test(x.name) && x.lang.startsWith('en')) ||
        voices.find(x => x.lang.startsWith('en')) || voices[0];
      if (v) u.voice = v;
      u.rate = s.rate || 1.05; u.pitch = s.pitch || 1.0; u.volume = s.volume || 1.0;
      u.onend = () => setState('standby');
      u.onerror = () => setState('standby');
      window.speechSynthesis.speak(u);
      const timer = setInterval(() => {
        if (!window.speechSynthesis.speaking) { clearInterval(timer); return; }
        window.speechSynthesis.pause(); window.speechSynthesis.resume();
      }, 8000);
    } catch (e) { setState('standby'); }
  }, []);

  const processCommand = useCallback(async (spokenText: string) => {
    const clean = spokenText.trim();
    if (!clean) { setState('standby'); return; }
    commandStartTimeRef.current = Date.now();
    setState('processing');

    if (/^(stop|never mind|nevermind|cancel|abort|quiet|shut up)$/i.test(clean)) {
      microphoneManager.stop();
      setState('standby');
      if (settingsRef.current.soundEffects) soundEffects.playBargeIn();
      return;
    }

    const local = tryParseLocalIntent(clean);
    if (local?.isHandledLocally) {
      const lat = Date.now() - commandStartTimeRef.current;
      setLastLatencyMs(lat);
      const userTurn: ConversationTurn = { id: 'turn-' + Math.random().toString(36).slice(2,9), role: 'user', text: clean, timestamp: Date.now(), latencyMs: lat, intent: local.intent, actionData: local.actionData };
      const fridayTurn: ConversationTurn = { id: 'turn-' + Math.random().toString(36).slice(2,9), role: 'friday', text: local.spokenReply, timestamp: Date.now(), latencyMs: lat, intent: local.intent, actionData: local.actionData };
      onTurnComplete(userTurn); onTurnComplete(fridayTurn);
      if (onLocalAction) onLocalAction(local.intent, local.actionData);
      speak(local.spokenReply);
      return;
    }

    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 12000);
    try {
      const hist = storageService.getConversations();
      const res = await fetch('/api/command', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctrl.signal,
        body: JSON.stringify({ message: clean, context: hist.slice(-4).map(h => ({ role: h.role, text: h.text })), personality: settings.personality, userTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone })
      });
      clearTimeout(t);
      const lat = Date.now() - commandStartTimeRef.current;
      setLastLatencyMs(lat);
      if (!res.ok) throw new Error(`Server ${res.status}`);
      const data = await res.json();
      const reply = data.spokenReply || data.reply || "Understood, sir. Systems updated.";
      onTurnComplete({ id: 'turn-' + Math.random().toString(36).slice(2,9), role: 'user', text: clean, timestamp: Date.now(), latencyMs: lat, intent: data.intent, actionData: data.actionData });
      onTurnComplete({ id: 'turn-' + Math.random().toString(36).slice(2,9), role: 'friday', text: reply, timestamp: Date.now(), latencyMs: lat, intent: data.intent, actionData: data.actionData });
      if (onLocalAction && data.intent) onLocalAction(data.intent, data.actionData);
      speak(reply);
    } catch (err) {
      clearTimeout(t);
      const lat = Date.now() - commandStartTimeRef.current;
      setLastLatencyMs(lat);
      const fb = "I've noted that, sir. All core executive functions are operating normally.";
      onTurnComplete({ id: 'turn-' + Math.random().toString(36).slice(2,9), role: 'user', text: clean, timestamp: Date.now(), latencyMs: lat, intent: 'fallback_response' });
      onTurnComplete({ id: 'turn-' + Math.random().toString(36).slice(2,9), role: 'friday', text: fb, timestamp: Date.now(), latencyMs: lat, intent: 'fallback_response' });
      speak(fb);
    }
  }, [onTurnComplete, onLocalAction, settings.personality, speak]);

  processCommandRef.current = processCommand;

  const interrupt = useCallback(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      try { window.speechSynthesis.cancel(); } catch {}
      if (settingsRef.current.soundEffects) soundEffects.playBargeIn();
    }
    microphoneManager.stop();
    setState('standby');
  }, []);

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
      onVolume: (lvl: number) => {
        setAudioLevel(lvl);
        setFrequencies(new Array(16).fill(0).map(() => Math.max(0, lvl * (0.5 + Math.random() * 0.5))));
      },
      onError: (err: string) => {
        console.error(err);
        setIsMicAvailable(false);
        setState('standby');
      }
    });
  }, []);

  const stopManualListening = useCallback(() => {
    const txt = microphoneManager.isActive() ? (transcript || interimTranscript) : '';
    microphoneManager.stop();
    if (txt.trim()) processCommandRef.current(txt.trim());
    else setState('standby');
  }, [transcript, interimTranscript]);

  // Continuous / wake-word mode with auto-restart guard
  useEffect(() => {
    if (!settings.continuousListening) {
      shouldRestartWakeWord.current = false;
      if (microphoneManager.getMode() === 'wake-word') microphoneManager.stop();
      return;
    }

    shouldRestartWakeWord.current = true;

    const tryStart = () => {
      if (!shouldRestartWakeWord.current) return;
      if (microphoneManager.isActive()) return;
      microphoneManager.start('wake-word', {
        onWakeWord: () => {
          setState('listening');
          if (settingsRef.current.soundEffects) soundEffects.playWakeChime();
        },
        onTranscript: (text: string, isFinal: boolean) => {
          if (isFinal && text) processCommandRef.current(text);
        },
        onVolume: (lvl: number) => {
          setAudioLevel(lvl);
          setFrequencies(new Array(16).fill(0).map(() => Math.max(0, lvl * (0.5 + Math.random() * 0.5))));
        },
        onError: (err: string) => { console.error(err); setIsMicAvailable(false); }
      });
    };

    tryStart();
    const interval = setInterval(() => {
      if (shouldRestartWakeWord.current && !microphoneManager.isActive()) tryStart();
    }, 1000);

    return () => {
      shouldRestartWakeWord.current = false;
      clearInterval(interval);
      if (microphoneManager.getMode() === 'wake-word') microphoneManager.stop();
    };
  }, [settings.continuousListening]);

  return {
    state, setState,
    transcript: transcript || interimTranscript,
    audioLevel, frequencies, isMicAvailable, lastLatencyMs,
    startManualListening, stopManualListening, interrupt, speak, processCommand
  };
}
