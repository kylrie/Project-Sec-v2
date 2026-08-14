import { useState, useEffect, useRef, useCallback } from 'react';
import { VoiceState, VoiceSettings, ConversationTurn } from '../types/friday';
import { soundEffects } from '../services/audioEffects';
import { storageService } from '../services/storage';
import { tryParseLocalIntent } from '../services/localIntentParser';

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
    webkitAudioContext: any;
  }
}

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
  const [frequencies, setFrequencies] = useState<number[]>(new Array(32).fill(0));
  const [isMicAvailable, setIsMicAvailable] = useState(true);
  const [lastLatencyMs, setLastLatencyMs] = useState<number | null>(null);

  const recognitionRef = useRef<any>(null);
  const synthesisRef = useRef<SpeechSynthesis | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const isListeningIntentRef = useRef<boolean>(false);
  const commandStartTimeRef = useRef<number>(0);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize SpeechSynthesis
  useEffect(() => {
    if (typeof window !== 'undefined') {
      synthesisRef.current = window.speechSynthesis;
    }
  }, []);

  // Setup Web Audio Analyser for Real Audio Waveform Visualization
  const setupAudioAnalyser = useCallback(async () => {
    try {
      if (audioContextRef.current && audioContextRef.current.state === 'running') {
        return;
      }
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      micStreamRef.current = stream;
      const ctx = new AudioCtx();
      audioContextRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateWaveform = () => {
        if (analyserRef.current) {
          analyserRef.current.getByteFrequencyData(dataArray);
          let sum = 0;
          const barValues: number[] = [];
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
            barValues.push(dataArray[i] / 255);
          }
          const avg = sum / dataArray.length / 255;
          setAudioLevel(avg);
          setFrequencies(barValues);
        }
        animFrameRef.current = requestAnimationFrame(updateWaveform);
      };

      updateWaveform();
      setIsMicAvailable(true);
    } catch (err) {
      console.warn('Microphone access for audio visualizer not available or denied', err);
      setIsMicAvailable(false);
    }
  }, []);

  // Barge-In & Speech Interrupter
  const interrupt = useCallback(() => {
    if (synthesisRef.current && (synthesisRef.current.speaking || synthesisRef.current.pending)) {
      synthesisRef.current.cancel();
      if (settings.soundEffects) soundEffects.playBargeIn();
      setState('interrupted');
      setTimeout(() => {
        setState('standby');
      }, 400);
    }
  }, [settings.soundEffects]);

  // Execute TTS with configured pitch, rate, and preferred voice
  const speak = useCallback((text: string) => {
    if (!synthesisRef.current) return;

    // Cancel any existing speech
    synthesisRef.current.cancel();
    setState('speaking');

    const cleanText = text.replace(/[*#_`]/g, '').trim();
    const utterance = new SpeechSynthesisUtterance(cleanText);
    currentUtteranceRef.current = utterance;

    const voices = synthesisRef.current.getVoices();
    let selectedVoice = null;

    if (settings.voiceName) {
      selectedVoice = voices.find(v => v.name === settings.voiceName);
    }
    if (!selectedVoice) {
      // Prioritize natural English female / assistant voices
      selectedVoice = voices.find(v => 
        (v.name.includes('Google US English') || v.name.includes('Samantha') || v.name.includes('Natural') || v.name.includes('Victoria') || v.name.includes('Karen') || v.name.includes('Zira') || v.name.includes('Female')) && v.lang.startsWith('en')
      ) || voices.find(v => v.lang.startsWith('en')) || voices[0];
    }

    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }

    utterance.rate = settings.rate;
    utterance.pitch = settings.pitch;
    utterance.volume = settings.volume;

    utterance.onend = () => {
      setState('standby');
      currentUtteranceRef.current = null;
    };

    utterance.onerror = (e) => {
      console.warn('TTS error', e);
      setState('standby');
      currentUtteranceRef.current = null;
    };

    synthesisRef.current.speak(utterance);
  }, [settings]);

  // Process User Command
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
      interrupt();
      return;
    }

    // 2. Try fast client-side local intent parser (<50ms)
    const localResult = tryParseLocalIntent(cleanText);
    if (localResult && localResult.isHandledLocally) {
      const latency = Date.now() - commandStartTimeRef.current;
      setLastLatencyMs(latency);

      const turn: ConversationTurn = {
        id: 'turn-' + Math.random().toString(36).substring(2, 9),
        role: 'user',
        text: cleanText,
        timestamp: Date.now(),
        latencyMs: latency,
        intent: localResult.intent,
        actionData: localResult.actionData
      };
      onTurnComplete(turn);

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

    // 3. Server-side Gemini API fallback
    try {
      const history = storageService.getConversations();
      const res = await fetch('/api/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: cleanText,
          context: history.slice(-6).map(h => ({ role: h.role, text: h.text })),
          personality: settings.personality,
          userTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        })
      });

      const latency = Date.now() - commandStartTimeRef.current;
      setLastLatencyMs(latency);

      if (!res.ok) throw new Error(`Server returned ${res.status}`);

      const data = await res.json();
      const replyText = data.spokenReply || data.reply || "Understood, sir.";

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
      console.error('Command processing failed', err);
      const fallbackReply = "Local systems are active, but cloud uplink experienced a timeout, sir.";
      speak(fallbackReply);
    }
  }, [interrupt, onTurnComplete, onLocalAction, settings.personality, speak]);

  // Speech Recognition Initializer
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setIsMicAvailable(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = settings.language || 'en-US';
    recognitionRef.current = recognition;

    recognition.onresult = (event: any) => {
      let finalStr = '';
      let interimStr = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const item = event.results[i];
        const text = item[0].transcript;
        if (item.isFinal) {
          finalStr += text;
        } else {
          interimStr += text;
        }
      }

      setInterimTranscript(interimStr);

      const incoming = (finalStr || interimStr).trim();
      const lower = incoming.toLowerCase();
      const wakeTarget = (settings.wakeWord || 'Hey Friday').toLowerCase();

      // Check for wake word trigger
      if (!isListeningIntentRef.current && (lower.includes(wakeTarget) || lower.includes('friday') || lower.includes('jarvis'))) {
        isListeningIntentRef.current = true;
        setState('listening');
        if (settings.soundEffects) soundEffects.playWakeChime();

        // Extract command following wake word if spoken together
        const match = incoming.match(new RegExp(`(?:hey )?(?:friday|jarvis)[,\\s]*(.*)`, 'i'));
        const remainder = match && match[1] ? match[1].trim() : '';
        if (remainder && finalStr) {
          setTranscript(remainder);
          isListeningIntentRef.current = false;
          processCommand(remainder);
        }
        return;
      }

      // If active listening mode and final text received
      if (finalStr && isListeningIntentRef.current) {
        setTranscript(finalStr);
        setInterimTranscript('');
        isListeningIntentRef.current = false;
        processCommand(finalStr);
      }
    };

    recognition.onstart = () => {
      setIsMicAvailable(true);
    };

    recognition.onerror = (event: any) => {
      if (event.error !== 'no-speech') {
        console.warn('Speech recognition error:', event.error);
      }
    };

    recognition.onend = () => {
      // Auto restart if continuous listening is enabled
      if (settings.continuousListening) {
        try {
          recognition.start();
        } catch {
          // ignore
        }
      } else {
        setState('standby');
      }
    };

    if (settings.continuousListening) {
      try {
        recognition.start();
      } catch (e) {
        console.warn('Could not auto-start continuous recognition', e);
      }
    }

    return () => {
      try {
        recognition.stop();
      } catch {
        // ignore
      }
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, [settings.continuousListening, settings.language, settings.wakeWord, settings.soundEffects, processCommand]);

  // Start Manual Listening
  const startManualListening = useCallback(() => {
    setupAudioAnalyser();
    interrupt();
    isListeningIntentRef.current = true;
    setState('listening');
    setTranscript('');
    setInterimTranscript('');
    if (settings.soundEffects) soundEffects.playWakeChime();

    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
      } catch {
        // Already started
      }
    }
  }, [interrupt, settings.soundEffects, setupAudioAnalyser]);

  // Stop Manual Listening and Send
  const stopManualListening = useCallback(() => {
    if (interimTranscript || transcript) {
      const textToProcess = transcript || interimTranscript;
      isListeningIntentRef.current = false;
      processCommand(textToProcess);
    } else {
      setState('standby');
      isListeningIntentRef.current = false;
    }
  }, [interimTranscript, transcript, processCommand]);

  // Global Hotkey Listener: Ctrl/Cmd + Shift + Space
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;
      if (isCmdOrCtrl && e.shiftKey && e.code === 'Space') {
        e.preventDefault();
        if (state === 'listening') {
          stopManualListening();
        } else {
          startManualListening();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state, startManualListening, stopManualListening]);

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
    processCommand,
    setupAudioAnalyser
  };
}
