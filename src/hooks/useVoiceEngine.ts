import { useState, useEffect, useRef, useCallback } from 'react';
import { VoiceState, VoiceSettings, ConversationTurn } from '../types/friday';
import { soundEffects } from '../services/audioEffects';
import { storageService } from '../services/storage';
import { tryParseLocalIntent } from '../services/localIntentParser';
import { VADService } from '../services/vadService';

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
  const [frequencies, setFrequencies] = useState<number[]>(new Array(16).fill(0));
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
  const isSettingUpMicRef = useRef<boolean>(false);
  const lastStateUpdateTimeRef = useRef<number>(0);

  const vadServiceRef = useRef<VADService | null>(null);
  const transcriptRef = useRef<string>('');
  const interimTranscriptRef = useRef<string>('');
  const processCommandRef = useRef<(spokenText: string) => Promise<void>>(() => Promise.resolve());
  const settingsRef = useRef<VoiceSettings>(settings);

  useEffect(() => {
    settingsRef.current = settings;
    if (recognitionRef.current && settings.language) {
      recognitionRef.current.lang = settings.language;
    }
  }, [settings]);

  // Initialize SpeechSynthesis and unlock on user interaction
  useEffect(() => {
    if (typeof window !== 'undefined') {
      synthesisRef.current = window.speechSynthesis;
      // Pre-fetch voices
      if (synthesisRef.current && synthesisRef.current.getVoices) {
        synthesisRef.current.getVoices();
        synthesisRef.current.onvoiceschanged = () => {
          synthesisRef.current?.getVoices();
        };
      }
    }
  }, []);

  // Setup Web Audio Analyser & VAD (Non-blocking with throttled React updates)
  const setupAudioAnalyser = useCallback(async () => {
    if (isSettingUpMicRef.current) return;

    try {
      isSettingUpMicRef.current = true;
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) {
        isSettingUpMicRef.current = false;
        return;
      }

      // 1. Ensure media stream is active
      if (!micStreamRef.current || !micStreamRef.current.active) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          micStreamRef.current = stream;
        } catch (e: any) {
          console.warn('[VoiceEngine] Microphone access not yet granted or busy:', e?.message);
          isSettingUpMicRef.current = false;
          return;
        }
      }

      // 2. Reuse or create singleton AudioContext gracefully
      let ctx = audioContextRef.current;
      if (!ctx || ctx.state === 'closed') {
        try {
          ctx = new AudioCtx();
          audioContextRef.current = ctx;
        } catch (ctxErr) {
          console.warn('[VoiceEngine] AudioContext creation notice:', ctxErr);
          isSettingUpMicRef.current = false;
          return;
        }
      }

      if (ctx && ctx.state === 'suspended') {
        await ctx.resume().catch(() => {});
      }

      // If analyser is already connected and running, avoid duplicate nodes
      if (analyserRef.current && ctx.state === 'running') {
        setIsMicAvailable(true);
        isSettingUpMicRef.current = false;
        return;
      }

      try {
        const source = ctx.createMediaStreamSource(micStreamRef.current);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 32;
        analyser.smoothingTimeConstant = 0.8;
        source.connect(analyser);
        analyserRef.current = analyser;

        // Initialize Voice Activity Detection (VAD) with 1.5s automatic silence cut-off
        if (!vadServiceRef.current) {
          vadServiceRef.current = new VADService({
            silenceTimeoutMs: 1500,
            energyThreshold: 0.022,
            onSpeechEnd: () => {
              if (isListeningIntentRef.current) {
                const pendingText = (transcriptRef.current || interimTranscriptRef.current).trim();
                if (pendingText) {
                  console.log('[VAD] 1.5s Silence detected. Auto-submitting spoken command:', pendingText);
                  isListeningIntentRef.current = false;
                  processCommandRef.current(pendingText);
                }
              }
            }
          });
        }
        vadServiceRef.current.start(micStreamRef.current, ctx);
      } catch (nodeErr) {
        console.warn('[VoiceEngine] MediaStream node setup notice:', nodeErr);
      }

      const dataArray = new Uint8Array(analyserRef.current ? analyserRef.current.frequencyBinCount : 16);

      // Throttled waveform updater (15fps max into React to prevent UI main-thread freezing!)
      const updateWaveform = () => {
        if (analyserRef.current) {
          try {
            analyserRef.current.getByteFrequencyData(dataArray);
            const now = performance.now();
            if (now - lastStateUpdateTimeRef.current > 66) { // ~15 FPS max
              lastStateUpdateTimeRef.current = now;
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
          } catch {}
        }
        animFrameRef.current = requestAnimationFrame(updateWaveform);
      };

      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      updateWaveform();
      setIsMicAvailable(true);
    } catch (err) {
      console.warn('[VoiceEngine] Microphone analyser notice:', err);
    } finally {
      isSettingUpMicRef.current = false;
    }
  }, []);



  // Barge-In & Speech Interrupter
  const interrupt = useCallback(() => {
    if (synthesisRef.current) {
      try {
        synthesisRef.current.cancel();
      } catch (e) {
        console.warn('Cancel speech error', e);
      }
      if (settingsRef.current.soundEffects) soundEffects.playBargeIn();
      setState('interrupted');
      setTimeout(() => {
        setState('standby');
      }, 300);
    }
  }, []);

  // Execute TTS (Fix for Chrome/Windows speech synthesis freeze)
  const speak = useCallback((text: string) => {
    if (!synthesisRef.current) return;

    try {
      // Fix Chrome speech synthesis hang bug
      window.speechSynthesis.cancel();
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }

      setState('speaking');

      const cleanText = text.replace(/[*#_`]/g, '').trim();
      const utterance = new SpeechSynthesisUtterance(cleanText);
      currentUtteranceRef.current = utterance;

      const currentSettings = settingsRef.current;
      const voices = synthesisRef.current.getVoices();
      let selectedVoice = null;

      if (currentSettings.voiceName) {
        selectedVoice = voices.find(v => v.name === currentSettings.voiceName);
      }
      if (!selectedVoice) {
        selectedVoice = voices.find(v => 
          (v.name.includes('Google US English') || v.name.includes('Samantha') || v.name.includes('Natural') || v.name.includes('Victoria') || v.name.includes('Zira') || v.name.includes('Female')) && v.lang.startsWith('en')
        ) || voices.find(v => v.lang.startsWith('en')) || voices[0];
      }

      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }

      utterance.rate = currentSettings.rate || 1.05;
      utterance.pitch = currentSettings.pitch || 1.0;
      utterance.volume = currentSettings.volume || 1.0;

      utterance.onend = () => {
        setState('standby');
        currentUtteranceRef.current = null;
      };

      utterance.onerror = (e) => {
        console.warn('TTS ended/cancelled', e);
        setState('standby');
        currentUtteranceRef.current = null;
      };

      synthesisRef.current.speak(utterance);

      // Keep-alive heartbeat for long speech on Chromium browsers
      const keepAliveTimer = setInterval(() => {
        if (!synthesisRef.current || !synthesisRef.current.speaking) {
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
      interrupt();
      return;
    }

    // 2. Try fast client-side local intent parser (<20ms response)
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
  }, [interrupt, onTurnComplete, onLocalAction, settings.personality, speak]);

  processCommandRef.current = processCommand;

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
      interimTranscriptRef.current = interimStr;

      const incoming = (finalStr || interimStr).trim();
      const lower = incoming.toLowerCase();
      const wakeTarget = (settingsRef.current.wakeWord || 'Hey Ahri').toLowerCase();

      // Check for wake word trigger (supports Ahri, Hey Ahri, and legacy aliases)
      if (!isListeningIntentRef.current && (lower.includes(wakeTarget) || lower.includes('ahri') || lower.includes('friday') || lower.includes('jarvis'))) {
        isListeningIntentRef.current = true;
        setState('listening');
        setupAudioAnalyser();
        if (settingsRef.current.soundEffects) soundEffects.playWakeChime();

        const match = incoming.match(new RegExp(`(?:hey\\s+)?(?:ahri|friday|jarvis)[,\\s]*(.*)`, 'i'));
        const remainder = match && match[1] ? match[1].trim() : '';
        if (remainder && finalStr) {
          setTranscript(remainder);
          transcriptRef.current = remainder;
          isListeningIntentRef.current = false;
          processCommand(remainder);
        }
        return;
      }

      // If active listening mode and final text received
      if (finalStr && isListeningIntentRef.current) {
        setTranscript(finalStr);
        transcriptRef.current = finalStr;
        setInterimTranscript('');
        interimTranscriptRef.current = '';
        isListeningIntentRef.current = false;
        processCommand(finalStr);
      }
    };

    recognition.onstart = () => {
      setIsMicAvailable(true);
    };

    recognition.onerror = (event: any) => {
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        console.warn('Speech recognition status:', event.error);
      }
    };

    recognition.onend = () => {
      if (settingsRef.current.continuousListening) {
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
        console.warn('Continuous recognition waiting for user gesture', e);
      }
    }

    return () => {
      try {
        recognition.stop();
      } catch {
        // ignore
      }
      if (vadServiceRef.current) {
        vadServiceRef.current.stop();
      }
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, [settings.continuousListening, settings.language, setupAudioAnalyser]);

  // Start Manual Listening (Non-blocking, instant response)
  const startManualListening = useCallback(() => {
    setupAudioAnalyser();
    interrupt();
    isListeningIntentRef.current = true;
    setState('listening');
    setTranscript('');
    transcriptRef.current = '';
    setInterimTranscript('');
    interimTranscriptRef.current = '';
    if (settingsRef.current.soundEffects) soundEffects.playWakeChime();

    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
      } catch {
        // Already started or active
      }
    }
  }, [interrupt, setupAudioAnalyser]);

  // Stop Manual Listening and Send
  const stopManualListening = useCallback(() => {
    const textToProcess = (transcriptRef.current || interimTranscriptRef.current || transcript || interimTranscript).trim();
    if (textToProcess) {
      isListeningIntentRef.current = false;
      processCommand(textToProcess);
    } else {
      setState('standby');
      isListeningIntentRef.current = false;
    }
  }, [interimTranscript, transcript, processCommand]);


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
