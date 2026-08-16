import React, { useState, useEffect } from 'react';
import { VoiceSettings, FridayPersonality } from '../types/friday';
import { X, Mic, MicOff, Volume2, Sliders, Sparkles, Globe, Keyboard, Check, VolumeX, Layers, Smartphone, Monitor, Radio } from 'lucide-react';

import { soundEffects } from '../services/audioEffects';
import { Overlay } from '../client/plugins/Overlay';
import { WakeWord } from '../client/plugins/WakeWord';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: VoiceSettings;
  onSaveSettings: (settings: VoiceSettings) => void;
  onTestVoice?: (text: string) => void;
  onLaunchWizard?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
  onTestVoice,
  onLaunchWizard
}) => {
  const [localSettings, setLocalSettings] = useState<VoiceSettings>(settings);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [availableMics, setAvailableMics] = useState<MediaDeviceInfo[]>([]);
  const [micEnumDone, setMicEnumDone] = useState(false);
  const [bubbleEnabled, setBubbleEnabled] = useState(false);
  const [wakeWordEnabled, setWakeWordEnabled] = useState(Boolean(settings.isWakeWordEnabled ?? settings.continuousListening ?? true));
  const [miniMode, setMiniMode] = useState(false);
  const [isCheckingBubble, setIsCheckingBubble] = useState(false);
  const [isSavedRecently, setIsSavedRecently] = useState(false);
  const isAndroidNative = Overlay.isAvailable();

  useEffect(() => {
    if (isOpen) {
      setLocalSettings(settings);
      setWakeWordEnabled(Boolean(settings.isWakeWordEnabled ?? settings.continuousListening ?? true));
      setIsSavedRecently(false);
    }
  }, [settings, isOpen]);

  useEffect(() => {
    if (isAndroidNative && isOpen) {
      Overlay.isBubbleVisible().then((res) => {
        setBubbleEnabled(res.visible);
      }).catch(() => {});
    }
  }, [isOpen, isAndroidNative]);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      const loadVoices = () => {
        try {
          const voices = window.speechSynthesis.getVoices();
          if (voices && voices.length > 0) {
            setAvailableVoices(voices);
          }
        } catch {}
      };
      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  // Enumerate available microphone input devices
  useEffect(() => {
    if (!isOpen) return;
    if (!navigator.mediaDevices?.enumerateDevices) {
      console.warn('[Settings] navigator.mediaDevices.enumerateDevices not available');
      setMicEnumDone(true);
      return;
    }

    const loadMics = async () => {
      try {
        // Request mic permission first so enumerateDevices returns labels
        if (navigator.mediaDevices.getUserMedia) {
          try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach(t => t.stop());
          } catch (permErr: any) {
            console.warn('[Settings] getUserMedia pre-grant failed (enumeration may still work):', permErr?.message || permErr);
          }
        }

        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices.filter(d => d.kind === 'audioinput');
        console.log('[Settings] Enumerated', audioInputs.length, 'audio input(s):', audioInputs.map(d => d.label || d.deviceId));
        setAvailableMics(audioInputs);
      } catch (e) {
        console.warn('[Settings] Could not enumerate microphones:', e);
      } finally {
        setMicEnumDone(true);
      }
    };

    setMicEnumDone(false);
    loadMics();
    // Re-enumerate if devices change (e.g. USB mic plugged in)
    const handleDeviceChange = () => loadMics();
    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
    return () => navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleToggleBubble = async () => {
    setIsCheckingBubble(true);
    try {
      if (!bubbleEnabled) {
        const perm = await Overlay.checkPermission();
        if (!perm.granted) {
          await Overlay.requestPermission();
          setIsCheckingBubble(false);
          return;
        }
        const res = await Overlay.showBubble();
        setBubbleEnabled(res.success);
      } else {
        const res = await Overlay.hideBubble();
        if (res.success) {
          setBubbleEnabled(false);
        }
      }
    } catch (e) {
      console.error('Error toggling bubble:', e);
    } finally {
      setIsCheckingBubble(false);
    }
  };

  const handleToggleWakeWord = async () => {
    const nextVal = !wakeWordEnabled;
    setWakeWordEnabled(nextVal);
    setLocalSettings(prev => ({
      ...prev,
      isWakeWordEnabled: nextVal,
      continuousListening: nextVal
    }));

    if (isAndroidNative) {
      try {
        if (nextVal) {
          await WakeWord.initialize();
          await WakeWord.startListening();
        } else {
          await WakeWord.stopListening();
        }
      } catch (e) {
        console.warn('Native wake word toggle notice:', e);
      }
    }
  };

  const handleSave = () => {
    const finalSettings: VoiceSettings = {
      ...localSettings,
      isWakeWordEnabled: wakeWordEnabled,
      continuousListening: wakeWordEnabled
    };

    try {
      if (finalSettings.soundEffects) {
        soundEffects.playAcknowledge();
      }
    } catch {}

    onSaveSettings(finalSettings);
    setIsSavedRecently(true);
    setTimeout(() => {
      onClose();
    }, 150);
  };


  const handleTestTTS = () => {
    const testPhrase = `Voice calibration confirmed. I am operating with ${localSettings.personality} executive protocols, speaking at rate ${localSettings.rate.toFixed(2)}.`;
    if (typeof onTestVoice === 'function') {
      onTestVoice(testPhrase);
    } else if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(testPhrase);
      utterance.rate = localSettings.rate;
      utterance.pitch = localSettings.pitch;
      window.speechSynthesis.speak(utterance);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
      <div className="bg-zinc-950 border border-sky-500/30 rounded-2xl max-w-xl w-full shadow-[0_0_50px_rgba(14,165,233,0.2)] overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/60">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-sky-500/10 rounded-lg">
              <Sliders className="w-4 h-4 text-sky-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-100 uppercase tracking-wider font-mono">
                Project Ahri Neural Voice & System Configuration
              </h3>
              <p className="text-[11px] text-zinc-400">Wake word, acoustic tuning, and executive personality</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-5 overflow-y-auto">
          {/* Wake Word Configuration */}
          <div className="space-y-2">
            <label className="text-xs font-mono text-zinc-300 uppercase tracking-wider flex items-center justify-between">
              <span className="flex items-center">
                <Mic className="w-3.5 h-3.5 text-sky-400 mr-1.5" />
                Wake Word Activation
              </span>
              <span className="text-[10px] text-zinc-500 font-normal">Continuous background listening</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {['Hey Ahri', 'AHRI', 'Hey Friday'].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setLocalSettings({ ...localSettings, wakeWord: preset })}
                  className={`p-2 rounded-lg text-xs font-mono border transition-all cursor-pointer ${
                    localSettings.wakeWord === preset
                      ? 'bg-sky-950/60 border-sky-500 text-sky-300 shadow-[0_0_10px_rgba(14,165,233,0.2)]'
                      : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  "{preset}"
                </button>
              ))}
            </div>
            <div className="mt-2">
              <input
                type="text"
                value={localSettings.wakeWord}
                onChange={(e) => setLocalSettings({ ...localSettings, wakeWord: e.target.value })}
                placeholder="Or type custom wake word..."
                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>

          {/* Microphone Input Device Selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-mono text-zinc-300 uppercase tracking-wider flex items-center justify-between">
              <span className="flex items-center">
                <Mic className="w-3.5 h-3.5 text-cyan-400 mr-1.5" />
                Microphone Input Device
              </span>
              {micEnumDone && availableMics.length === 0 && (
                <span className="flex items-center text-[10px] text-amber-400 font-normal">
                  <MicOff className="w-3 h-3 mr-1" />
                  No mics detected
                </span>
              )}
              {!micEnumDone && (
                <span className="text-[10px] text-zinc-500 font-normal">Scanning…</span>
              )}
            </label>
            <select
              value={localSettings.micDeviceId}
              onChange={(e) => setLocalSettings({ ...localSettings, micDeviceId: e.target.value })}
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-sky-500"
            >
              <option value="">System Default Microphone</option>
              {availableMics.map((mic) => (
                <option key={mic.deviceId} value={mic.deviceId}>
                  {mic.label || `Microphone (${mic.deviceId.slice(0, 8)}…)`}
                </option>
              ))}
            </select>
          </div>

          {/* Personality Style */}
          <div className="space-y-2">
            <label className="text-xs font-mono text-zinc-300 uppercase tracking-wider flex items-center">
              <Sparkles className="w-3.5 h-3.5 text-purple-400 mr-1.5" />
              Executive Assistant Personality
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: 'professional', label: 'Professional', desc: 'Poised & capable' },
                { id: 'concise', label: 'Concise', desc: 'Ultra-fast bullet points' },
                { id: 'warm', label: 'Warm', desc: 'Attentive & courteous' },
                { id: 'executive', label: 'Chief of Staff', desc: 'High-leverage action items' },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setLocalSettings({ ...localSettings, personality: p.id as FridayPersonality })}
                  className={`p-2.5 rounded-lg text-left border transition-all cursor-pointer ${
                    localSettings.personality === p.id
                      ? 'bg-purple-950/60 border-purple-500 text-purple-200 shadow-[0_0_10px_rgba(168,85,247,0.2)]'
                      : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <p className="text-xs font-semibold">{p.label}</p>
                  <p className="text-[10px] opacity-70 mt-0.5">{p.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* TTS Voice Selection & Tuning */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-mono text-zinc-300 uppercase tracking-wider flex items-center">
                <Volume2 className="w-3.5 h-3.5 text-cyan-400 mr-1.5" />
                Text-To-Speech (TTS) Voice Engine
              </label>
              <button
                type="button"
                onClick={handleTestTTS}
                className="text-xs text-sky-400 hover:text-sky-300 underline font-mono"
              >
                Test Voice Sample
              </button>
            </div>

            <select
              value={localSettings.voiceName}
              onChange={(e) => setLocalSettings({ ...localSettings, voiceName: e.target.value })}
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-sky-500"
            >
              <option value="">Default Natural Assistant Voice (Google/Apple)</option>
              {availableVoices.map((v, i) => (
                <option key={i} value={v.name}>
                  {v.name} ({v.lang})
                </option>
              ))}
            </select>

            <div className="grid grid-cols-2 gap-4 pt-1">
              <div>
                <div className="flex justify-between text-[11px] text-zinc-400 mb-1">
                  <span>Speaking Speed</span>
                  <span className="font-mono">{localSettings.rate.toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min="0.75"
                  max="1.5"
                  step="0.05"
                  value={localSettings.rate}
                  onChange={(e) => setLocalSettings({ ...localSettings, rate: parseFloat(e.target.value) })}
                  className="w-full accent-sky-500"
                />
              </div>

              <div>
                <div className="flex justify-between text-[11px] text-zinc-400 mb-1">
                  <span>Pitch Modulation</span>
                  <span className="font-mono">{localSettings.pitch.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0.8"
                  max="1.3"
                  step="0.05"
                  value={localSettings.pitch}
                  onChange={(e) => setLocalSettings({ ...localSettings, pitch: parseFloat(e.target.value) })}
                  className="w-full accent-sky-500"
                />
              </div>
            </div>
          </div>

          {/* Primary Language */}
          <div className="space-y-1.5">
            <label className="text-xs font-mono text-zinc-300 uppercase tracking-wider flex items-center">
              <Globe className="w-3.5 h-3.5 text-emerald-400 mr-1.5" />
              Primary Recognition Language
            </label>
            <select
              value={localSettings.language}
              onChange={(e) => setLocalSettings({ ...localSettings, language: e.target.value })}
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-sky-500"
            >
              <option value="en-US">English (United States)</option>
              <option value="en-GB">English (United Kingdom)</option>
              <option value="es-ES">Spanish (Español)</option>
              <option value="fr-FR">French (Français)</option>
              <option value="de-DE">German (Deutsch)</option>
              <option value="ja-JP">Japanese (日本語)</option>
              <option value="zh-CN">Mandarin Chinese (中文)</option>
            </select>
          </div>

          {/* Advanced Toggles: Barge-in & Sound Effects */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div className="p-3 rounded-xl bg-zinc-900/50 border border-zinc-800 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-zinc-200">Barge-in Interruption</p>
                <p className="text-[10px] text-zinc-500">Say "Stop" or speak to cut off speech</p>
              </div>
              <div className="flex items-center space-x-2">
                <span className={`text-[10px] font-mono font-bold tracking-wider ${localSettings.bargeInEnabled ? 'text-sky-400' : 'text-zinc-500'}`}>
                  {localSettings.bargeInEnabled ? 'ON' : 'OFF'}
                </span>
                <button
                  type="button"
                  onClick={() => setLocalSettings({ ...localSettings, bargeInEnabled: !localSettings.bargeInEnabled })}
                  className={`w-10 h-5.5 rounded-full transition-all relative p-0.5 cursor-pointer ${
                    localSettings.bargeInEnabled ? 'bg-sky-500 shadow-[0_0_10px_rgba(14,165,233,0.4)]' : 'bg-zinc-800 border border-zinc-700'
                  }`}
                >
                  <div className={`w-4.5 h-4.5 rounded-full bg-white transition-transform ${localSettings.bargeInEnabled ? 'translate-x-4.5' : 'translate-x-0'}`} />
                </button>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-zinc-900/50 border border-zinc-800 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-zinc-200">HUD Sound Effects</p>
                <p className="text-[10px] text-zinc-500">Futuristic chimes & telemetry pings</p>
              </div>
              <div className="flex items-center space-x-2">
                <span className={`text-[10px] font-mono font-bold tracking-wider ${localSettings.soundEffects ? 'text-sky-400' : 'text-zinc-500'}`}>
                  {localSettings.soundEffects ? 'ON' : 'OFF'}
                </span>
                <button
                  type="button"
                  onClick={() => setLocalSettings({ ...localSettings, soundEffects: !localSettings.soundEffects })}
                  className={`w-10 h-5.5 rounded-full transition-all relative p-0.5 cursor-pointer ${
                    localSettings.soundEffects ? 'bg-sky-500 shadow-[0_0_10px_rgba(14,165,233,0.4)]' : 'bg-zinc-800 border border-zinc-700'
                  }`}
                >
                  <div className={`w-4.5 h-4.5 rounded-full bg-white transition-transform ${localSettings.soundEffects ? 'translate-x-4.5' : 'translate-x-0'}`} />
                </button>
              </div>
            </div>
          </div>

          {/* Android Floating Overlay Bubble System Feature */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-sky-950/40 via-zinc-900/60 to-zinc-900/40 border border-sky-500/30 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className={`p-2.5 rounded-xl transition-colors ${bubbleEnabled ? 'bg-sky-500/30 text-sky-300 shadow-[0_0_12px_rgba(14,165,233,0.3)]' : 'bg-sky-500/10 text-sky-400'}`}>
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h4 className="text-xs font-bold text-zinc-100 uppercase tracking-wider font-mono">
                    System Floating Overlay Bubble
                  </h4>
                  <span className="px-1.5 py-0.5 text-[9px] font-semibold bg-sky-500/20 text-sky-300 rounded border border-sky-500/30 uppercase">
                    Android
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  Always-on-top chat head. Tap mic to trigger Ahri anytime over other apps.
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2.5">
              <span className={`text-xs font-mono font-bold tracking-wider px-2 py-0.5 rounded border transition-all ${
                bubbleEnabled 
                  ? 'bg-sky-500/20 text-sky-300 border-sky-500/40 shadow-[0_0_10px_rgba(14,165,233,0.3)]' 
                  : 'bg-zinc-800/80 text-zinc-500 border-zinc-700'
              }`}>
                {bubbleEnabled ? '● ON' : '○ OFF'}
              </span>
              <button
                type="button"
                disabled={isCheckingBubble}
                onClick={handleToggleBubble}
                aria-label="Toggle Floating Bubble"
                className={`w-12 h-6.5 rounded-full transition-all duration-300 relative p-0.5 cursor-pointer focus:outline-none ${
                  bubbleEnabled
                    ? 'bg-sky-500 shadow-[0_0_15px_rgba(14,165,233,0.5)]'
                    : 'bg-zinc-800 border border-zinc-700 hover:bg-zinc-700'
                }`}
              >
                <div
                  className={`w-5.5 h-5.5 rounded-full bg-white shadow-md transition-transform duration-300 flex items-center justify-center ${
                    bubbleEnabled ? 'translate-x-5.5' : 'translate-x-0'
                  }`}
                >
                  <Smartphone className={`w-3 h-3 ${bubbleEnabled ? 'text-sky-600' : 'text-zinc-500'}`} />
                </div>
              </button>
            </div>
          </div>

          {/* Always-On Wake Word Detection */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-950/40 via-zinc-900/60 to-zinc-900/40 border border-emerald-500/30 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className={`p-2.5 rounded-xl transition-colors ${wakeWordEnabled ? 'bg-emerald-500/30 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.3)]' : 'bg-emerald-500/10 text-emerald-400'}`}>
                <Mic className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h4 className="text-xs font-bold text-zinc-100 uppercase tracking-wider font-mono">
                    Always-On "Hey Ahri" Wake Word
                  </h4>
                  <span className="px-1.5 py-0.5 text-[9px] font-semibold bg-emerald-500/20 text-emerald-300 rounded border border-emerald-500/30 uppercase">
                    Free / Zero-Key
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  Hands-free continuous recognition. Say "Hey Ahri" to trigger listening without pressing any buttons.
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2.5">
              <span className={`text-xs font-mono font-bold tracking-wider px-2 py-0.5 rounded border transition-all ${
                wakeWordEnabled 
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-[0_0_10px_rgba(16,185,129,0.3)]' 
                  : 'bg-zinc-800/80 text-zinc-500 border-zinc-700'
              }`}>
                {wakeWordEnabled ? '● ON' : '○ OFF'}
              </span>
              <button
                type="button"
                onClick={handleToggleWakeWord}
                aria-label="Toggle Always-On Wake Word"
                className={`w-12 h-6.5 rounded-full transition-all duration-300 relative p-0.5 cursor-pointer focus:outline-none ${
                  wakeWordEnabled
                    ? 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]'
                    : 'bg-zinc-800 border border-zinc-700 hover:bg-zinc-700'
                }`}
              >
                <div
                  className={`w-5.5 h-5.5 rounded-full bg-white shadow-md transition-transform duration-300 flex items-center justify-center ${
                    wakeWordEnabled ? 'translate-x-5.5' : 'translate-x-0'
                  }`}
                >
                  <Mic className={`w-3 h-3 ${wakeWordEnabled ? 'text-emerald-600' : 'text-zinc-500'}`} />
                </div>
              </button>
            </div>
          </div>


          {/* Windows Desktop Always-On-Top Mini Mode */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-purple-950/30 via-zinc-900/60 to-zinc-900/40 border border-purple-500/30 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className={`p-2.5 rounded-xl transition-colors ${miniMode ? 'bg-purple-500/30 text-purple-300 shadow-[0_0_12px_rgba(168,85,247,0.3)]' : 'bg-purple-500/10 text-purple-400'}`}>
                <Monitor className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h4 className="text-xs font-bold text-zinc-100 uppercase tracking-wider font-mono">
                    Always-On-Top Mini Mode
                  </h4>
                  <span className="px-1.5 py-0.5 text-[9px] font-semibold bg-purple-500/20 text-purple-300 rounded border border-purple-500/30 uppercase">
                    Windows
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  Pin Ahri to the corner as a 400×600 compact widget. Global hotkey: <kbd className="px-1.5 py-0.5 bg-zinc-800 rounded font-mono text-purple-300 text-[10px]">Ctrl+Shift+M</kbd>
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2.5">
              <span className={`text-xs font-mono font-bold tracking-wider px-2 py-0.5 rounded border transition-all ${
                miniMode 
                  ? 'bg-purple-500/20 text-purple-300 border-purple-500/40 shadow-[0_0_10px_rgba(168,85,247,0.3)]' 
                  : 'bg-zinc-800/80 text-zinc-500 border-zinc-700'
              }`}>
                {miniMode ? '● ON' : '○ OFF'}
              </span>
              <button
                type="button"
                onClick={() => {
                  setMiniMode(prev => !prev);
                  if (typeof window !== 'undefined' && (window as any).electronAPI?.toggleMiniMode) {
                    (window as any).electronAPI.toggleMiniMode();
                  } else {
                    alert('Mini overlay mode hotkey is Ctrl+Shift+M in the Windows desktop app.');
                  }
                }}
                aria-label="Toggle Always-On-Top Mini Mode"
                className={`w-12 h-6.5 rounded-full transition-all duration-300 relative p-0.5 cursor-pointer focus:outline-none ${
                  miniMode
                    ? 'bg-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.5)]'
                    : 'bg-zinc-800 border border-zinc-700 hover:bg-zinc-700'
                }`}
              >
                <div
                  className={`w-5.5 h-5.5 rounded-full bg-white shadow-md transition-transform duration-300 flex items-center justify-center ${
                    miniMode ? 'translate-x-5.5' : 'translate-x-0'
                  }`}
                >
                  <Layers className={`w-3 h-3 ${miniMode ? 'text-purple-600' : 'text-zinc-500'}`} />
                </div>
              </button>
            </div>
          </div>

          {/* Cross-Device Neural Mesh Status */}

          <div className="p-4 rounded-xl bg-gradient-to-r from-sky-950/30 via-zinc-900/60 to-zinc-900/40 border border-sky-500/30 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-sky-500/20 text-sky-400 rounded-xl">
                <Radio className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h4 className="text-xs font-bold text-zinc-100 uppercase tracking-wider font-mono">
                    Cross-Device Neural Mesh
                  </h4>
                  <span className="px-1.5 py-0.5 text-[9px] font-semibold bg-sky-500/20 text-sky-300 rounded border border-sky-500/30 uppercase">
                    Active Mesh
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  Synchronizes actions across Windows PC, Android phone/bubble, and smart devices via real-time WebSocket broker.
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-mono font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5 animate-ping" />
                Mesh Online
              </span>
            </div>
          </div>
        </div>




        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-zinc-800 bg-zinc-900/40">
          <div className="flex items-center space-x-1 text-[11px] text-zinc-500 font-mono">
            <Keyboard className="w-3.5 h-3.5" />
            <span>Shortcut: ⌘/Ctrl+Shift+Space</span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs rounded-lg font-medium"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className={`px-4 py-1.5 text-xs font-semibold rounded-lg flex items-center space-x-1.5 shadow-[0_0_15px_rgba(14,165,233,0.3)] transition-colors ${
                isSavedRecently 
                  ? 'bg-emerald-600 text-white' 
                  : 'bg-sky-600 hover:bg-sky-500 text-white'
              }`}
            >
              <Check className="w-3.5 h-3.5" />
              <span>{isSavedRecently ? 'Saved!' : 'Apply Configuration'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
