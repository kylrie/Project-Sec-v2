import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Settings, 
  Shield, 
  Layers, 
  Calendar, 
  Clock, 
  Users, 
  Radio, 
  Sparkles, 
  Volume2, 
  Mic, 
  Terminal, 
  X,
  ChevronUp,
  Brain,
  Activity,
  PhoneCall,
  CheckCircle2,
  Sliders
} from 'lucide-react';

import { HolographicCore } from './components/HolographicCore';
import { CommandOverlay } from './components/CommandOverlay';
import { TimersAndTasks } from './components/TimersAndTasks';
import { ExecutiveSchedule } from './components/ExecutiveSchedule';
import { CommunicationsTriage } from './components/CommunicationsTriage';
import { UnifiedCommunicationsHub } from './components/UnifiedCommunicationsHub';
import { LiveMeetingRecorder } from './components/LiveMeetingRecorder';
import { PrivacyVault } from './components/PrivacyVault';
import { CrossPlatformDeliverables } from './components/CrossPlatformDeliverables';
import { GoogleWorkspaceHub } from './components/GoogleWorkspaceHub';
import { SettingsModal } from './components/SettingsModal';
import { SecretaryBrainHub } from './components/SecretaryBrainHub';
import { CrossDeviceSyncCenter } from './components/CrossDeviceSyncCenter';
import { AppStoreAndDistributionPortal } from './components/AppStoreAndDistributionPortal';
import { VoiceOnboardingWizard } from './components/VoiceOnboardingWizard';

import { useVoiceEngine } from './hooks/useVoiceEngine';
import { storageService } from './services/storage';
import { soundSynth } from './services/audioEffects';
import { ConversationTurn, VoiceSettings, ActiveTimer, ReminderItem, CalendarEvent, MessageItem } from './types/friday';

export default function App() {
  const [settings, setSettings] = useState<VoiceSettings>(storageService.getSettings());
  const [conversations, setConversations] = useState<ConversationTurn[]>(storageService.getConversations());
  const [timers, setTimers] = useState<ActiveTimer[]>(storageService.getTimers());
  const [reminders, setReminders] = useState<ReminderItem[]>(storageService.getReminders());
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>(storageService.getCalendar());
  const [messages, setMessages] = useState<MessageItem[]>(storageService.getMessages());

  // Clean single-drawer hub state
  const [isExecutiveDrawerOpen, setIsExecutiveDrawerOpen] = useState(false);
  const [activeDrawerTab, setActiveDrawerTab] = useState<'briefing' | 'schedule' | 'comms' | 'meetings' | 'vault' | 'settings'>('briefing');
  const [isCommandOverlayOpen, setIsCommandOverlayOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [latestActionFeedback, setLatestActionFeedback] = useState<{ intent: string; text: string } | null>(null);

  // Sync timers to local storage
  const handleUpdateTimers = (newTimers: ActiveTimer[] | ((prev: ActiveTimer[]) => ActiveTimer[])) => {
    setTimers(prev => {
      const updated = typeof newTimers === 'function' ? newTimers(prev) : newTimers;
      storageService.saveTimers(updated);
      return updated;
    });
  };

  const handleUpdateReminders = (newReminders: ReminderItem[]) => {
    setReminders(newReminders);
    storageService.saveReminders(newReminders);
  };

  const handleAddCalendarEvent = (event: CalendarEvent) => {
    const updated = [event, ...calendarEvents];
    setCalendarEvents(updated);
    storageService.saveCalendar(updated);
  };

  const handleDeleteCalendarEvent = (id: string) => {
    const updated = calendarEvents.filter(e => e.id !== id);
    setCalendarEvents(updated);
    storageService.saveCalendar(updated);
  };

  const handleUpdateMessages = (newMessages: MessageItem[]) => {
    setMessages(newMessages);
    storageService.saveMessages(newMessages);
  };

  const handleTurnComplete = (turn: ConversationTurn) => {
    storageService.saveConversationTurn(turn);
    setConversations(storageService.getConversations());
  };

  const handleLocalAction = (intent: string, data: any) => {
    if (intent === 'set_timer') {
      setTimers(storageService.getTimers());
      setLatestActionFeedback({ intent, text: `Timer active: ${data.label || 'Countdown'} (${Math.floor(data.durationSeconds / 60)} min)` });
    } else if (intent === 'set_reminder') {
      setReminders(storageService.getReminders());
      setLatestActionFeedback({ intent, text: `Reminder logged: ${data.task} (${data.dueTime})` });
    } else if (intent === 'schedule_event') {
      setCalendarEvents(storageService.getCalendar());
      setLatestActionFeedback({ intent, text: `Calendar event booked: ${data.title}` });
    } else if (intent === 'get_time') {
      setLatestActionFeedback({ intent, text: `Current time: ${data.time}` });
    } else if (intent === 'get_weather') {
      setLatestActionFeedback({ intent, text: `Weather: ${data.tempF}°F, ${data.condition}` });
    } else if (intent.includes('meeting')) {
      setActiveDrawerTab('meetings');
      setIsExecutiveDrawerOpen(true);
      setLatestActionFeedback({ intent, text: `Meeting Intelligence active` });
    }
  };

  const handleBlockCalendar = (timeStr: string, reason: string) => {
    const newEvent: CalendarEvent = {
      id: 'focus-' + Date.now(),
      title: `Focus Time: ${reason}`,
      date: 'Today',
      startTime: timeStr,
      endTime: '6:00 PM',
      type: 'briefing',
      location: 'Quiet Work Room'
    };
    handleAddCalendarEvent(newEvent);
    setLatestActionFeedback({ intent: 'schedule_event', text: `Reserved ${timeStr} for ${reason}` });
  };

  const {
    state,
    transcript,
    frequencies,
    audioLevel,
    lastLatencyMs,
    startManualListening,
    stopManualListening,
    processCommand,
    speak,
    interrupt
  } = useVoiceEngine({
    settings,
    onTurnComplete: handleTurnComplete,
    onLocalAction: handleLocalAction,
  });

  const handleCoreClick = () => {
    if (state === 'speaking') {
      interrupt();
    } else if (state === 'listening') {
      stopManualListening();
    } else {
      startManualListening();
    }
  };

  const handleSaveSettings = (newSettings: VoiceSettings) => {
    setSettings(newSettings);
    storageService.saveSettings(newSettings);
  };

  const handleDataPurged = () => {
    setConversations(storageService.getConversations());
    setTimers(storageService.getTimers());
    setReminders(storageService.getReminders());
    setCalendarEvents(storageService.getCalendar());
    setMessages(storageService.getMessages());
  };

  const isSpeaking = state === 'speaking';
  const isListening = state === 'listening';

  return (
    <div className="min-h-screen bg-[#050914] text-zinc-100 font-sans flex flex-col justify-between relative overflow-hidden selection:bg-sky-500 selection:text-white">
      {/* Background Soft Glow Aura */}
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
        <div className="absolute top-[20%] left-[50%] translate-x-[-50%] translate-y-[-50%] w-[800px] h-[800px] bg-sky-950/20 blur-[160px] rounded-full pointer-events-none" />
      </div>

      {/* 1. ULTRA-MINIMAL TOP BAR */}
      <header className="w-full max-w-5xl mx-auto px-6 py-6 flex items-center justify-between z-20">
        {/* Left: Sleek Brand Logo */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <h1 className="text-sm font-semibold tracking-[0.25em] text-zinc-100 uppercase font-mono">
              AHRI
            </h1>
          </div>
          <span className="text-[10px] font-mono text-zinc-500 tracking-wider">
            PROJECT AHRI • EXECUTIVE
          </span>
        </div>

        {/* Right: Single Compact Hub Toggle */}
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setIsExecutiveDrawerOpen(true)}
            className="flex items-center space-x-2 px-3 py-1.5 rounded-full bg-zinc-900/60 hover:bg-zinc-800/80 border border-zinc-800 text-xs font-mono text-zinc-300 transition-all cursor-pointer shadow-sm hover:border-sky-500/40"
          >
            <Sliders className="w-3.5 h-3.5 text-sky-400" />
            <span>Executive Hub</span>
          </button>

          <button
            onClick={() => setIsSettingsOpen(true)}
            className="p-2 rounded-full bg-zinc-900/60 hover:bg-zinc-800/80 border border-zinc-800 text-zinc-400 hover:text-white transition-all cursor-pointer"
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* 2. THE HEART: UNCLIPPED EXPANSIVE 3D STARDUST ORB */}
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 flex flex-col items-center justify-center z-10 my-auto">
        {/* 3D Quantum Orb Component */}
        <div className="w-full flex justify-center items-center">
          <HolographicCore
            state={state}
            frequencies={frequencies}
            audioLevel={audioLevel}
            wakeWord={settings.wakeWord || 'Hey Ahri'}
            latencyMs={lastLatencyMs}
            onCoreClick={handleCoreClick}
            onInterrupt={interrupt}
          />
        </div>

        {/* Dynamic Live Speech Captions */}
        <div className="min-h-[56px] w-full max-w-xl mx-auto flex flex-col items-center justify-center px-4 text-center my-3">
          <AnimatePresence mode="wait">
            {isListening && (
              <motion.div
                key="listening"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="flex items-center space-x-2 text-cyan-300"
              >
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                <p className="text-lg sm:text-xl font-light text-zinc-100 italic tracking-wide">
                  "{transcript || 'Listening to you...'}"
                </p>
              </motion.div>
            )}

            {isSpeaking && conversations.length > 0 && (
              <motion.p
                key="speaking"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="text-base sm:text-lg font-light text-zinc-200 leading-relaxed max-w-lg drop-shadow-sm"
              >
                {conversations[conversations.length - 1].role === 'ahri' || conversations[conversations.length - 1].role === 'friday'
                  ? conversations[conversations.length - 1].text
                  : ''}
              </motion.p>
            )}

            {latestActionFeedback && !isListening && !isSpeaking && (
              <motion.div
                key="feedback"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-cyan-950/60 border border-cyan-500/30 text-xs font-mono text-cyan-300"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
                <span>{latestActionFeedback.text}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 3. ONE UNIFIED BUTTON FOR EVERYTHING */}
        <div className="flex flex-col items-center justify-center mt-2 mb-8">
          <button
            id="btn-unified-voice-action"
            onClick={isSpeaking ? interrupt : handleCoreClick}
            className={`group relative flex items-center space-x-3 px-8 py-4 rounded-full font-mono text-sm tracking-wider uppercase transition-all duration-300 cursor-pointer shadow-2xl ${
              isSpeaking
                ? 'bg-emerald-500/25 hover:bg-emerald-500/35 border border-emerald-400/60 text-emerald-200 shadow-[0_0_35px_rgba(16,185,129,0.35)] animate-pulse'
                : isListening
                ? 'bg-cyan-500/25 hover:bg-cyan-500/35 border border-cyan-400/60 text-cyan-200 shadow-[0_0_35px_rgba(6,182,212,0.35)] animate-pulse'
                : 'bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-700/60 hover:border-sky-400/60 text-zinc-100 shadow-[0_0_25px_rgba(0,0,0,0.5)]'
            }`}
          >
            {/* Pulsing indicator ring */}
            <span className={`w-3 h-3 rounded-full ${isSpeaking ? 'bg-emerald-400 animate-ping' : isListening ? 'bg-cyan-400 animate-ping' : 'bg-sky-400'}`} />
            
            <span className="font-semibold tracking-[0.2em]">
              {isSpeaking ? 'AHRI Speaking (Stop)' : isListening ? 'Listening...' : 'Talk with Ahri'}
            </span>

            <Mic className={`w-4 h-4 ${isSpeaking ? 'text-emerald-300 animate-pulse' : isListening ? 'text-cyan-300 animate-bounce' : 'text-zinc-400 group-hover:text-sky-400'} transition-colors`} />
          </button>

          <p className="mt-3 text-[11px] font-mono text-zinc-500 tracking-wider">
            Press to talk • or say <span className="text-zinc-300">"{settings.wakeWord || 'Hey Ahri'}"</span>
          </p>
        </div>
      </main>

      {/* 4. CLEAN EXECUTIVE DRAWER (ALL FEATURES IN ONE EXPANDABLE HUB) */}
      <AnimatePresence>
        {isExecutiveDrawerOpen && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6 bg-black/75 backdrop-blur-xl">
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              className="w-full max-w-4xl max-h-[85vh] bg-zinc-950 border border-zinc-800 sm:rounded-3xl rounded-t-3xl shadow-2xl flex flex-col overflow-hidden"
            >
              {/* Drawer Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/80 bg-zinc-900/40">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-xl bg-sky-500/20 border border-sky-500/40 flex items-center justify-center">
                    <Brain className="w-4 h-4 text-sky-400" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold font-mono tracking-wider text-zinc-100 uppercase">
                      Executive Intelligence Hub
                    </h2>
                    <p className="text-[11px] text-zinc-400 font-mono">
                      Integrated briefing, tasks, meetings & vault
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setIsExecutiveDrawerOpen(false)}
                  className="p-2 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Drawer Segmented Navigation */}
              <div className="flex items-center space-x-2 px-6 py-3 border-b border-zinc-800/60 bg-zinc-900/20 overflow-x-auto">
                {[
                  { id: 'briefing', label: 'Briefing', icon: Brain },
                  { id: 'schedule', label: 'Schedule & Tasks', icon: Calendar },
                  { id: 'comms', label: 'Communications', icon: PhoneCall },
                  { id: 'meetings', label: 'Meeting Recorder', icon: Users },
                  { id: 'vault', label: 'Privacy Vault', icon: Shield },
                ].map(tab => {
                  const Icon = tab.icon;
                  const isActive = activeDrawerTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveDrawerTab(tab.id as any)}
                      className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl text-xs font-mono transition-all cursor-pointer shrink-0 ${
                        isActive
                          ? 'bg-sky-500 text-zinc-950 font-bold shadow-md shadow-sky-500/20'
                          : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Drawer Scrollable Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {activeDrawerTab === 'briefing' && (
                  <SecretaryBrainHub
                    onSpeak={speak}
                    onBlockCalendar={handleBlockCalendar}
                    onOpenMessageThread={() => setActiveDrawerTab('comms')}
                    soundSynth={soundSynth}
                  />
                )}

                {activeDrawerTab === 'schedule' && (
                  <div className="space-y-6">
                    <TimersAndTasks
                      timers={timers}
                      reminders={reminders}
                      onUpdateTimers={handleUpdateTimers}
                      onUpdateReminders={handleUpdateReminders}
                    />
                    <ExecutiveSchedule
                      events={calendarEvents}
                      onAddEvent={handleAddCalendarEvent}
                      onDeleteEvent={handleDeleteCalendarEvent}
                    />
                  </div>
                )}

                {activeDrawerTab === 'comms' && (
                  <UnifiedCommunicationsHub
                    messages={messages}
                    onUpdateMessages={handleUpdateMessages}
                    onSpeak={speak}
                  />
                )}

                {activeDrawerTab === 'meetings' && (
                  <LiveMeetingRecorder onSpeakSummary={speak} />
                )}

                {activeDrawerTab === 'vault' && (
                  <PrivacyVault
                    conversations={conversations}
                    onDataPurged={handleDataPurged}
                  />
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Global Command Overlay */}
      <CommandOverlay
        isOpen={isCommandOverlayOpen}
        onClose={() => setIsCommandOverlayOpen(false)}
        onSubmitCommand={processCommand}
        onStartVoice={startManualListening}
        voiceState={state}
        wakeWord={settings.wakeWord}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSaveSettings={handleSaveSettings}
        onLaunchWizard={() => {
          setIsSettingsOpen(false);
          setIsOnboardingOpen(true);
        }}
      />

      {/* 5-Min Voice Setup Wizard Modal */}
      {isOnboardingOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl">
          <div className="w-full max-w-2xl bg-zinc-950 border border-zinc-800 rounded-3xl p-6 relative shadow-2xl">
            <button
              onClick={() => setIsOnboardingOpen(false)}
              className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-white rounded-full bg-zinc-900 hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
            <VoiceOnboardingWizard
              onComplete={() => setIsOnboardingOpen(false)}
              onSpeak={speak}
              onSelectPersonality={(p) => handleSaveSettings({ ...settings, personality: p })}
              soundSynth={soundSynth}
            />
          </div>
        </div>
      )}
    </div>
  );
}
