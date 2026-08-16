import { useState, useEffect, useRef, useCallback } from 'react';
import { VoiceState, VoiceSettings, ConversationTurn, AhriResponse } from '../types/friday';
import { soundEffects } from '../services/audioEffects';
import { storageService } from '../services/storage';
import { tryParseLocalIntent } from '../services/localIntentParser';
import { microphoneManager } from '../services/microphoneManager';
import { userMemory } from '../services/userMemory';
import { detectPersonas } from '../services/companionRegistry';
import { detectSkill, executeSkillStep } from '../skills';

interface UseVoiceEngineProps {
  settings: VoiceSettings;
  onTurnComplete: (turn: ConversationTurn) => void;
  onLocalAction?: (intent: string, data: any) => void;
}

export function useVoiceEngine({ settings, onTurnComplete, onLocalAction }: UseVoiceEngineProps) {
  const [state, setState] = useState<VoiceState>('standby');
  const [transcript, setTranscript] = useState<string>('');
  const [interimTranscript, setInterimTranscript] = useState<string>('');
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [frequencies, setFrequencies] = useState<number[]>(new Array(16).fill(0));
  const [isMicAvailable, setIsMicAvailable] = useState<boolean>(true);
  const [lastLatencyMs, setLastLatencyMs] = useState<number | null>(null);
  const [activities, setActivities] = useState<Array<{ personaId: string; action: string; status: 'running' | 'done' | 'error' }>>([]);
  const [activePersonas, setActivePersonas] = useState<string[]>([]);

  const commandStartTimeRef = useRef<number>(0);
  const settingsRef = useRef<VoiceSettings>(settings);
  const processCommandRef = useRef<(text: string) => Promise<void>>(() => Promise.resolve());
  const shouldRestartWakeWord = useRef<boolean>(false);

  const activeAudioRef = useRef<HTMLAudioElement | null>(null);

  const speak = useCallback((text: string) => {
    const cleanText = text.replace(/[*#_`]/g, '').trim();
    if (!cleanText) return;

    // Cancel previous audio or utterance
    if (activeAudioRef.current) {
      try {
        activeAudioRef.current.pause();
        activeAudioRef.current.currentTime = 0;
      } catch {}
      activeAudioRef.current = null;
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      try { window.speechSynthesis.cancel(); } catch {}
    }

    setState('speaking');

    if (typeof window === 'undefined' || !window.speechSynthesis) {
      setState('standby');
      return;
    }

    try {
      if (window.speechSynthesis.paused) window.speechSynthesis.resume();
      window.speechSynthesis.cancel(); // Cancel any lingering utterance

      const u = new SpeechSynthesisUtterance(cleanText);
      const voices = window.speechSynthesis.getVoices();
      const s = settingsRef.current;
      const v = voices.find(x => x.name === s.voiceName) ||
        voices.find(x => /Google|Natural|Jenny|Aria|Samantha|Zira|Microsoft/i.test(x.name) && x.lang.startsWith('en')) ||
        voices.find(x => x.lang.startsWith('en')) || voices[0];

      if (v) u.voice = v;
      u.rate = s.rate || 1.05;
      u.pitch = s.pitch || 1.0;
      u.volume = s.volume || 1.0;
      u.onend = () => setState('standby');
      u.onerror = () => setState('standby');

      window.speechSynthesis.speak(u);
    } catch {
      setState('standby');
    }
  }, []);

  const processCommand = useCallback(async (spokenText: string) => {
    const clean = spokenText.trim();
    if (!clean) { setState('standby'); return; }
    commandStartTimeRef.current = Date.now();
    setState('processing');

    if (/^(stop|never mind|nevermind|cancel|abort|quiet|shut up)$/i.test(clean)) {
      microphoneManager.stop();
      setState('standby');
      setActivities([]);
      setActivePersonas([]);
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
      userMemory.learnFromConversation([userTurn, fridayTurn]);
      return;
    }

    // 1. Detect Multi-Step Skills or Specialist Personas
    const matchedSkill = detectSkill(clean);
    const detectedSpecialists = detectPersonas(clean);
    if (matchedSkill && !detectedSpecialists.includes(matchedSkill.primaryPersona)) {
      detectedSpecialists.push(matchedSkill.primaryPersona);
    }
    setActivePersonas(detectedSpecialists);

    // If a multi-step skill is triggered, initialize workflow steps on the HUD
    if (matchedSkill) {
      setActivities(matchedSkill.steps.map((s, idx) => ({
        personaId: s.personaId || matchedSkill.primaryPersona,
        action: s.description,
        status: idx === 0 ? 'running' : 'running'
      })));

      // Pre-execute local workflow integration if needed
      for (const step of matchedSkill.steps) {
        if (step.type === 'api') {
          await executeSkillStep(step, clean);
        }
      }
    } else {
      setActivities(detectedSpecialists.map(p => ({
        personaId: p,
        action: p === 'ahri' ? 'Analyzing executive intent...' : `Specialist ${p} evaluating task...`,
        status: 'running'
      })));
    }

    // 2. Single Unified Gemini 3.7 Pro Agentic Call
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 12000);
    try {
      const hist = storageService.getConversations();
      const res = await fetch('/api/command', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctrl.signal,
        body: JSON.stringify({
          message: clean,
          userContext: userMemory.buildContextPrompt(),
          personas: detectedSpecialists,
          skillId: matchedSkill?.id,
          context: hist.slice(-4).map(h => ({ role: h.role, text: h.text })),
          personality: settings.personality,
          userTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        })
      });
      clearTimeout(t);
      const lat = Date.now() - commandStartTimeRef.current;
      setLastLatencyMs(lat);
      if (!res.ok) throw new Error(`Server ${res.status}`);
      const data: AhriResponse = await res.json();
      const reply = data.spokenReply || (data as any).reply || "Understood, sir. Systems updated.";

      // Update specialist activity HUD with results
      if (data.routing && data.routing.length > 0) {
        setActivities(data.routing.map(r => ({
          personaId: r.persona,
          action: r.action,
          status: r.status
        })));
        setTimeout(() => {
          setActivities([]);
          setActivePersonas([]);
        }, 4500);
      } else {
        setActivities([]);
        setActivePersonas([]);
      }

      const userTurn: ConversationTurn = { id: 'turn-' + Math.random().toString(36).slice(2,9), role: 'user', text: clean, timestamp: Date.now(), latencyMs: lat, intent: data.intent, actionData: data.actionData };
      const fridayTurn: ConversationTurn = { id: 'turn-' + Math.random().toString(36).slice(2,9), role: 'friday', text: reply, timestamp: Date.now(), latencyMs: lat, intent: data.intent, actionData: data.actionData };
      onTurnComplete(userTurn);
      onTurnComplete(fridayTurn);
      if (onLocalAction && data.intent) onLocalAction(data.intent, data.actionData);
      speak(reply);
      userMemory.learnFromConversation([
        ...hist.slice(-4),
        userTurn,
        fridayTurn
      ]);
    } catch (err) {
      clearTimeout(t);
      const lat = Date.now() - commandStartTimeRef.current;
      setLastLatencyMs(lat);
      setActivities(prev => prev.map(a => ({ ...a, status: 'error' })));
      setTimeout(() => {
        setActivities([]);
        setActivePersonas([]);
      }, 4000);
      const fb = "I've noted that, sir. All core executive functions are operating normally.";
      onTurnComplete({ id: 'turn-' + Math.random().toString(36).slice(2,9), role: 'user', text: clean, timestamp: Date.now(), latencyMs: lat, intent: 'fallback_response' });
      onTurnComplete({ id: 'turn-' + Math.random().toString(36).slice(2,9), role: 'friday', text: fb, timestamp: Date.now(), latencyMs: lat, intent: 'fallback_response' });
      speak(fb);
    }
  }, [onTurnComplete, onLocalAction, settings.personality, speak]);

  processCommandRef.current = processCommand;

  const interrupt = useCallback(() => {
    if (activeAudioRef.current) {
      try {
        activeAudioRef.current.pause();
        activeAudioRef.current.currentTime = 0;
      } catch {}
      activeAudioRef.current = null;
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      try { window.speechSynthesis.cancel(); } catch {}
      if (settingsRef.current.soundEffects) soundEffects.playBargeIn();
    }
    microphoneManager.stop();
    setState('standby');
    setActivities([]);
    setActivePersonas([]);
  }, []);

  const startManualListening = useCallback(() => {
    if (activeAudioRef.current) {
      try {
        activeAudioRef.current.pause();
        activeAudioRef.current.currentTime = 0;
      } catch {}
      activeAudioRef.current = null;
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      try { window.speechSynthesis.cancel(); } catch {}
    }
    setState('listening');
    setTranscript('');
    setInterimTranscript('');
    if (settingsRef.current.soundEffects) soundEffects.playWakeChime();

    microphoneManager.start('command', {
      onTranscript: (text: string, isFinal: boolean) => {
        if (isFinal && text) {
          setTranscript(text);
          setInterimTranscript('');
          processCommandRef.current(text);
        } else if (!isFinal) {
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

  const stopManualListening = useCallback(async () => {
    const activeText = transcript || interimTranscript;
    if (activeText.trim()) {
      microphoneManager.stop();
      processCommandRef.current(activeText.trim());
    } else {
      setState('processing');
      await microphoneManager.stop();
    }
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
    activities, activePersonas,
    startManualListening, stopManualListening, interrupt, speak, processCommand
  };
}
