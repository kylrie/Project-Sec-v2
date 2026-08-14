import React, { useState, useEffect } from 'react';
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
  Smartphone, 
  Monitor, 
  ChevronRight,
  Maximize2,
  CheckCircle2,
  Activity,
  PhoneCall,
  Brain,
  Store,
  Compass,
  Play
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
import { googleWorkspaceService } from './services/googleWorkspace';
import { soundSynth } from './services/audioEffects';
import { ConversationTurn, VoiceSettings, ActiveTimer, ReminderItem, CalendarEvent, MessageItem, FridayPersonality } from './types/friday';

export default function App() {
  const [settings, setSettings] = useState<VoiceSettings>(storageService.getSettings());
  const [conversations, setConversations] = useState<ConversationTurn[]>(storageService.getConversations());
  const [timers, setTimers] = useState<ActiveTimer[]>(storageService.getTimers());
  const [reminders, setReminders] = useState<ReminderItem[]>(storageService.getReminders());
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>(storageService.getCalendar());
  const [messages, setMessages] = useState<MessageItem[]>(storageService.getMessages());

  const [activeView, setActiveView] = useState<'dashboard' | 'secretary' | 'sync' | 'communications' | 'workspace' | 'meeting' | 'distribution' | 'vault' | 'deliverables'>('secretary');
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
    } else if (intent === 'start_meeting_recording' || intent === 'join_google_meet' || intent === 'flag_meeting_moment' || intent === 'end_meeting_generate_minutes' || intent === 'sync_meeting_tasks') {
      setActiveView('meeting');
      setLatestActionFeedback({ intent, text: `Meeting Intelligence: ${intent.replace(/_/g, ' ').toUpperCase()}` });
    } else if (
      intent === 'initiate_phone_call' ||
      intent === 'answer_phone_call' ||
      intent === 'decline_phone_call' ||
      intent === 'send_to_voicemail' ||
      intent === 'summarize_last_call' ||
      intent === 'send_sms_voice' ||
      intent === 'send_viber_voice' ||
      intent === 'send_messenger_voice' ||
      intent === 'summarize_messenger_group' ||
      intent === 'read_otp_code' ||
      intent === 'get_communication_digest' ||
      intent === 'enable_dnd_meeting' ||
      intent === 'enable_driving_mode' ||
      intent === 'disable_dnd'
    ) {
      setActiveView('communications');
      setLatestActionFeedback({
        intent,
        text: `Communication Manager: ${intent.replace(/_/g, ' ').toUpperCase()}`
      });
    }

    setTimeout(() => {
      setLatestActionFeedback(null);
    }, 6000);
  };

  const {
    state,
    transcript,
    audioLevel,
    frequencies,
    lastLatencyMs,
    startManualListening,
    stopManualListening,
    interrupt,
    speak,
    processCommand
  } = useVoiceEngine({
    settings,
    onTurnComplete: handleTurnComplete,
    onLocalAction: handleLocalAction
  });

  const handleSaveSettings = (newSettings: VoiceSettings) => {
    setSettings(newSettings);
    storageService.saveSettings(newSettings);
  };

  const handleBlockCalendar = (title: string, start: string, durationMinutes: number) => {
    const newEvt: CalendarEvent = {
      id: 'cal-block-' + Date.now(),
      title,
      startTime: start,
      endTime: '06:00 PM',
      date: 'Today',
      type: 'briefing',
      location: 'Reserved Focus Block'
    };
    handleAddCalendarEvent(newEvt);
  };

  const handleSelectPersonality = (p: FridayPersonality) => {
    const updated = { ...settings, personality: p };
    handleSaveSettings(updated);
  };

  const handleCoreClick = () => {
    if (state === 'listening') {
      stopManualListening();
    } else if (state === 'speaking') {
      interrupt();
    } else {
      startManualListening();
    }
  };

  const handleDataPurged = () => {
    setConversations([]);
    setTimers([]);
    setReminders(storageService.getReminders());
    setCalendarEvents(storageService.getCalendar());
    setMessages(storageService.getMessages());
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans flex flex-col relative overflow-x-hidden selection:bg-sky-500 selection:text-white">
      {/* Dynamic Futuristic Ambient HUD Gradients */}
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
        <div className="absolute top-[-10%] left-[20%] w-[600px] h-[600px] bg-sky-900/15 blur-[140px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[10%] w-[500px] h-[500px] bg-cyan-900/10 blur-[130px] rounded-full" />
        <div className="absolute top-[40%] right-[-10%] w-[400px] h-[400px] bg-purple-900/10 blur-[150px] rounded-full" />
        {/* Subtle grid pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b0a_1px,transparent_1px),linear-gradient(to_bottom,#1e293b0a_1px,transparent_1px)] bg-[size:4rem_4rem]" />
      </div>

      {/* Top Navigation & Status Bar */}
      <header className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-zinc-800/80 z-20">
        {/* Logo & Brand Identity */}
        <div className="flex items-center space-x-3">
          <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-sky-500/20 to-sky-950 border border-sky-400/40 shadow-[0_0_15px_rgba(56,189,248,0.25)]">
            <span className="font-mono text-sky-400 font-black text-base">F</span>
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-400 rounded-full animate-ping" />
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-400 rounded-full" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-sm font-bold tracking-widest text-zinc-100 uppercase font-mono">
                FRIDAY OS
              </h1>
              <span className="px-1.5 py-0.2 rounded bg-sky-950 border border-sky-800 text-sky-400 text-[10px] font-mono font-medium">
                v2.6 Executive
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 font-mono flex items-center space-x-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>Secretary Brain Online • E2EE Mesh Synced</span>
            </p>
          </div>
        </div>

        {/* Action Controls & Navigation Pills */}
        <div className="flex flex-wrap items-center gap-2">
          {/* 5-Min Voice Setup Wizard Button */}
          <button
            id="btn-voice-onboarding"
            onClick={() => setIsOnboardingOpen(true)}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500/20 to-blue-600/20 hover:from-cyan-500/30 hover:to-blue-600/30 border border-cyan-500/40 text-xs text-cyan-300 font-mono transition-all cursor-pointer shadow-sm"
            title="Launch 5-Minute Voice-Guided Setup Wizard"
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            <span>Voice Setup Wizard</span>
          </button>

          {/* Quick Overlay Summon Button */}
          <button
            onClick={() => setIsCommandOverlayOpen(true)}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs text-zinc-300 font-mono transition-all hover:border-sky-500/50 cursor-pointer"
            title="Summon Quick Launcher (Cmd/Ctrl+Shift+Space)"
          >
            <Terminal className="w-3.5 h-3.5 text-sky-400" />
            <span className="hidden md:inline">Command HUD</span>
            <kbd className="px-1.5 py-0.2 rounded bg-zinc-950 text-[10px] text-zinc-400 border border-zinc-800">
              ⌘+Shift+Space
            </kbd>
          </button>

          {/* Privacy Vault Button */}
          <button
            onClick={() => setActiveView('vault')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border text-xs font-mono transition-all cursor-pointer ${
              activeView === 'vault'
                ? 'bg-emerald-950/60 border-emerald-500 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.2)]'
                : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-zinc-300'
            }`}
          >
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
            <span>Privacy Vault</span>
          </button>

          {/* Settings Button */}
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
            title="Configure Wake Word & Voice"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-2 flex flex-col items-center z-10">
        {/* Clean Holographic Atom HUD Center */}
        <section className="w-full flex flex-col items-center justify-center">
          <HolographicCore
            state={state}
            frequencies={frequencies}
            audioLevel={audioLevel}
            wakeWord={settings.wakeWord}
            latencyMs={lastLatencyMs}
            onCoreClick={handleCoreClick}
            onInterrupt={interrupt}
          />

          {/* Live Dynamic Speech Captions (Only shown when active or providing feedback) */}
          <div className="min-h-[44px] w-full max-w-2xl mx-auto flex flex-col items-center justify-center px-4 text-center my-1">
            <AnimatePresence mode="wait">
              {state === 'listening' && (
                <motion.div
                  key="listening"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="flex items-center space-x-2 text-cyan-400"
                >
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                  <p className="text-lg sm:text-xl font-light text-zinc-100 italic tracking-wide">
                    "{transcript || 'Listening for your command...'}"
                  </p>
                </motion.div>
              )}

              {state === 'speaking' && conversations.length > 0 && (
                <motion.p
                  key="speaking"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="text-base sm:text-lg font-normal text-zinc-100 leading-relaxed drop-shadow-sm max-w-xl"
                >
                  {conversations[conversations.length - 1].role === 'friday'
                    ? conversations[conversations.length - 1].text
                    : ''}
                </motion.p>
              )}

              {latestActionFeedback && (
                <motion.div
                  key="feedback"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="inline-flex items-center space-x-2 px-3 py-1 rounded-xl bg-cyan-950/80 border border-cyan-500/40 text-xs font-mono text-cyan-200 shadow-[0_0_15px_rgba(6,182,212,0.25)]"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
                  <span>{latestActionFeedback.text}</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </section>

        {/* Clean Streamlined Navigation Tabs */}
        <div className="w-full max-w-4xl flex items-center justify-center border-b border-zinc-800/80 pb-2 mb-5">
          <div className="flex items-center justify-center flex-wrap gap-1 p-1 bg-zinc-900/60 rounded-2xl border border-zinc-800/80 backdrop-blur-md">
            {[
              { id: 'secretary', label: 'Secretary Brain', icon: Brain },
              { id: 'dashboard', label: 'Operations', icon: Activity },
              { id: 'communications', label: 'Telephony & Chat', icon: PhoneCall },
              { id: 'workspace', label: 'Workspace', icon: Sparkles },
              { id: 'meeting', label: 'Meetings', icon: Users },
              { id: 'sync', label: 'Mesh Sync', icon: Radio },
              { id: 'distribution', label: 'Store Releases', icon: Store },
              { id: 'deliverables', label: 'Architecture', icon: Layers },
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = activeView === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveView(tab.id as any)}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-mono transition-all cursor-pointer ${
                    isActive
                      ? 'bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/20'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Dynamic Main Viewport */}
        <section className="w-full max-w-5xl">
          {activeView === 'secretary' && (
            <SecretaryBrainHub
              onSpeak={speak}
              onBlockCalendar={handleBlockCalendar}
              onOpenMessageThread={() => setActiveView('communications')}
              soundSynth={soundSynth}
            />
          )}

          {activeView === 'sync' && (
            <CrossDeviceSyncCenter
              soundSynth={soundSynth}
              onSpeak={speak}
            />
          )}

          {activeView === 'dashboard' && (
            <div className="space-y-6">
              {/* Row 1: Timers and Action Items */}
              <TimersAndTasks
                timers={timers}
                reminders={reminders}
                onUpdateTimers={handleUpdateTimers}
                onUpdateReminders={handleUpdateReminders}
              />

              {/* Row 2: Schedule & Communications */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ExecutiveSchedule
                  events={calendarEvents}
                  onAddEvent={handleAddCalendarEvent}
                  onDeleteEvent={handleDeleteCalendarEvent}
                />
                <CommunicationsTriage
                  messages={messages}
                  onUpdateMessages={handleUpdateMessages}
                  onSpeakReply={speak}
                  onOpenFullHub={() => setActiveView('communications')}
                />
              </div>
            </div>
          )}

          {activeView === 'communications' && (
            <UnifiedCommunicationsHub
              messages={messages}
              onUpdateMessages={handleUpdateMessages}
              onSpeak={speak}
            />
          )}

          {activeView === 'workspace' && (
            <GoogleWorkspaceHub
              onSpeak={speak}
              onVoiceCommandTrigger={processCommand}
            />
          )}

          {activeView === 'meeting' && (
            <LiveMeetingRecorder onSpeakSummary={speak} />
          )}

          {activeView === 'distribution' && (
            <AppStoreAndDistributionPortal
              soundSynth={soundSynth}
              onSpeak={speak}
            />
          )}

          {activeView === 'vault' && (
            <PrivacyVault
              conversations={conversations}
              onDataPurged={handleDataPurged}
            />
          )}

          {activeView === 'deliverables' && (
            <CrossPlatformDeliverables />
          )}
        </section>
      </main>

      {/* Global Command HUD Spotlight Overlay */}
      <CommandOverlay
        isOpen={isCommandOverlayOpen}
        onClose={() => setIsCommandOverlayOpen(false)}
        onSubmitCommand={processCommand}
        onStartVoice={startManualListening}
        voiceState={state}
        wakeWord={settings.wakeWord}
      />

      {/* Settings & Voice Tuning Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSaveSettings={handleSaveSettings}
        onTestVoice={speak}
      />

      {/* 5-Minute Voice Onboarding Modal Overlay */}
      {isOnboardingOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <VoiceOnboardingWizard
              onComplete={() => setIsOnboardingOpen(false)}
              onSpeak={speak}
              onSelectPersonality={handleSelectPersonality}
              soundSynth={soundSynth}
            />
          </div>
        </div>
      )}

      {/* Footer Info */}
      <footer className="w-full border-t border-zinc-900 py-4 px-6 text-center text-xs text-zinc-600 font-mono">
        <p>FRIDAY Assistant • Cross-Platform Autonomous Executive Interface • Local-First Architecture</p>
      </footer>
    </div>
  );
}
