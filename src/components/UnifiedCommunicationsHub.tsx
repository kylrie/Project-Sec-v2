import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Mail,
  MessageSquare,
  Send,
  CheckCircle2,
  Sparkles,
  Phone,
  PhoneCall,
  PhoneIncoming,
  PhoneOff,
  PhoneForwarded,
  Shield,
  Volume2,
  Copy,
  Clock,
  Car,
  Moon,
  AlertTriangle,
  UserCheck,
  Search,
  ExternalLink,
  ChevronRight,
  RefreshCw,
  Sliders,
  Play,
  Share2,
  Layers,
  MapPin,
  Calendar as CalendarIcon,
  Check,
  Plus
} from 'lucide-react';

import { MessageItem, CommunicationChannel, CommunicationSettings, CallSession, ExtractedEntities } from '../types/friday';
import { communicationService } from '../services/communicationService';
import { soundEffects } from '../services/audioEffects';
import { storageService } from '../services/storage';

interface UnifiedCommunicationsHubProps {
  messages: MessageItem[];
  onUpdateMessages: (messages: MessageItem[]) => void;
  onSpeak: (text: string) => void;
}

export const UnifiedCommunicationsHub: React.FC<UnifiedCommunicationsHubProps> = ({
  messages,
  onUpdateMessages,
  onSpeak
}) => {
  const [commSettings, setCommSettings] = useState<CommunicationSettings>(storageService.getCommunicationSettings());
  const [selectedChannel, setSelectedChannel] = useState<'all' | 'urgent' | 'sms' | 'viber' | 'messenger' | 'phone_call'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [selectedMsg, setSelectedMsg] = useState<MessageItem | null>(null);
  const [replyText, setReplyText] = useState('');
  const [smartReplies, setSmartReplies] = useState<string[]>([]);
  const [isGeneratingReplies, setIsGeneratingReplies] = useState(false);
  const [dispatchedSuccessId, setDispatchedSuccessId] = useState<string | null>(null);
  const [copiedOtp, setCopiedOtp] = useState<string | null>(null);

  // Incoming Call Simulation State
  const [incomingCall, setIncomingCall] = useState<CallSession | null>(null);
  const [activeCallDuration, setActiveCallDuration] = useState(0);

  // Group Chat Summary Drawer / Modal
  const [groupSummaryData, setGroupSummaryData] = useState<{
    groupName: string;
    threeSentenceSummary: string;
    keyDecisions: string[];
    pendingActionItems: string[];
    spokenBriefing: string;
  } | null>(null);
  const [isSummarizingGroup, setIsSummarizingGroup] = useState(false);

  // Settings / DND Panel toggle
  const [showSettingsDrawer, setShowSettingsDrawer] = useState(false);

  // New Compose Modal
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [composeChannel, setComposeChannel] = useState<CommunicationChannel>('sms');
  const [composeRecipient, setComposeRecipient] = useState('');
  const [composeBody, setComposeBody] = useState('');

  // Save settings when updated
  const handleUpdateSettings = (newSettings: CommunicationSettings) => {
    setCommSettings(newSettings);
    storageService.saveCommunicationSettings(newSettings);
  };

  // Timer for active call
  useEffect(() => {
    let interval: any;
    if (incomingCall && incomingCall.state === 'connected') {
      interval = setInterval(() => {
        setActiveCallDuration(prev => prev + 1);
      }, 1000);
    } else {
      setActiveCallDuration(0);
    }
    return () => clearInterval(interval);
  }, [incomingCall?.state]);

  // Filter messages based on tab & query
  const filteredMessages = messages.filter(msg => {
    if (selectedChannel === 'urgent' && !msg.priority.includes('urgent') && !msg.isVip) return false;
    if (selectedChannel === 'sms' && msg.source !== 'sms') return false;
    if (selectedChannel === 'viber' && msg.source !== 'viber') return false;
    if (selectedChannel === 'messenger' && msg.source !== 'messenger') return false;
    if (selectedChannel === 'phone_call' && msg.source !== 'phone_call') return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        msg.sender.toLowerCase().includes(q) ||
        msg.content.toLowerCase().includes(q) ||
        (msg.subject && msg.subject.toLowerCase().includes(q)) ||
        (msg.extractedEntities?.otpCode && msg.extractedEntities.otpCode.includes(q))
      );
    }
    return true;
  });

  // Calculate unread counts
  const unreadTotal = messages.filter(m => m.unread).length;
  const unreadUrgent = messages.filter(m => m.unread && (m.priority === 'urgent' || m.isVip)).length;
  const unreadSMS = messages.filter(m => m.unread && m.source === 'sms').length;
  const unreadViber = messages.filter(m => m.unread && m.source === 'viber').length;
  const unreadMessenger = messages.filter(m => m.unread && m.source === 'messenger').length;
  const unreadCalls = messages.filter(m => m.unread && m.source === 'phone_call').length;

  // Handle selecting a message & generating smart replies
  const handleSelectMessage = async (msg: MessageItem) => {
    setSelectedMsg(msg);
    setReplyText(msg.suggestedReply || '');
    
    // Mark as read
    if (msg.unread) {
      const updated = messages.map(m => m.id === msg.id ? { ...m, unread: false } : m);
      onUpdateMessages(updated);
      storageService.saveMessages(updated);
    }

    // Generate context-aware smart replies
    if (msg.suggestedReplies && msg.suggestedReplies.length > 0) {
      setSmartReplies(msg.suggestedReplies);
    } else {
      setIsGeneratingReplies(true);
      const replies = await communicationService.generateSmartReplies(msg);
      setSmartReplies(replies);
      setIsGeneratingReplies(false);
    }
  };

  // Dispatch reply across channel
  const handleDispatchReply = (msg: MessageItem, textToSend: string) => {
    if (!textToSend.trim()) return;
    soundEffects.playAcknowledge();
    setDispatchedSuccessId(msg.id);

    let spokenConf = '';
    if (msg.source === 'sms') {
      const res = communicationService.sendSMS(msg.senderHandle, textToSend);
      spokenConf = res.spokenConfirmation;
    } else if (msg.source === 'viber') {
      const res = communicationService.sendViberMessage(msg.senderHandle, textToSend);
      spokenConf = res.spokenConfirmation;
    } else if (msg.source === 'messenger') {
      const res = communicationService.sendMessengerMessage(msg.senderHandle, textToSend);
      spokenConf = res.spokenConfirmation;
    } else if (msg.source === 'phone_call') {
      const res = communicationService.sendSMS(msg.senderHandle, textToSend);
      spokenConf = `Sent SMS reply to caller ${msg.sender}: "${textToSend}".`;
    } else {
      spokenConf = `Reply sent to ${msg.sender}.`;
    }

    onSpeak(spokenConf);

    setTimeout(() => {
      setDispatchedSuccessId(null);
      setSelectedMsg(null);
      setReplyText('');
    }, 1200);
  };

  // Trigger Communication Digest
  const handlePlayDigest = () => {
    soundEffects.playActivate();
    const digest = communicationService.generateCommunicationDigest(messages);
    onSpeak(digest.vocalScript);
  };

  // Copy OTP code
  const handleCopyOtp = (otp: string) => {
    navigator.clipboard.writeText(otp);
    setCopiedOtp(otp);
    soundEffects.playBeep();
    onSpeak(`Copied verification code ${otp} to clipboard.`);
    setTimeout(() => setCopiedOtp(null), 2500);
  };

  // Read message aloud
  const handleReadAloud = (msg: MessageItem) => {
    soundEffects.playAcknowledge();
    let text = `Message from ${msg.sender} via ${msg.source.toUpperCase()}. `;
    if (msg.subject) text += `Subject: ${msg.subject}. `;
    text += `Content: ${msg.content}`;
    if (msg.extractedEntities?.otpCode) {
      text += ` Security code is ${msg.extractedEntities.otpCode}.`;
    }
    onSpeak(text);
  };

  // Direct Phone Call
  const handleCallContact = (contactName: string, phoneNumber: string) => {
    soundEffects.playActivate();
    const res = communicationService.initiatePhoneCall(phoneNumber, contactName);
    onSpeak(res.spokenReply);
  };

  // Trigger Incoming Call Simulation
  const handleSimulateIncomingCall = () => {
    soundEffects.playAlert();
    const newCall: CallSession = {
      id: 'call-' + Date.now(),
      callerName: 'Elena Vance (VP AI Strategy)',
      callerHandle: '+1 (555) 749-1029',
      state: 'ringing',
      startedAt: Date.now(),
      durationSec: 0,
      liveTranscript: [
        'Elena: Glad I caught you!',
        'Elena: We just completed the Whisper neural engine benchmark on local hardware.',
        'Elena: Latency dropped to 142ms. Can we approve the rollout for Q3 tonight?'
      ]
    };
    setIncomingCall(newCall);

    if (commSettings.dndMode === 'meeting') {
      onSpeak(`Emergency call breakthrough from VIP contact Elena Vance. Incoming call on cellular line.`);
    } else {
      onSpeak(`Incoming cellular call from Elena Vance, VP of AI Strategy. Shall I answer, decline, or send to voicemail?`);
    }
  };

  // Call Screener Actions
  const handleAnswerCall = () => {
    if (!incomingCall) return;
    soundEffects.playAcknowledge();
    setIncomingCall({ ...incomingCall, state: 'connected' });
    onSpeak(`Call connected. Acoustic audio screening active.`);
  };

  const handleDeclineCall = () => {
    if (!incomingCall) return;
    soundEffects.playBeep();
    setIncomingCall(null);
    onSpeak(`Call declined. Dispatched polite auto-responder text.`);
  };

  const handleSendCallVoicemail = () => {
    if (!incomingCall) return;
    soundEffects.playAcknowledge();
    setIncomingCall({ ...incomingCall, state: 'voicemail' });
    onSpeak(`Routing to FRIDAY Voicemail. Live audio transcription active.`);
    
    setTimeout(() => {
      setIncomingCall(null);
      onSpeak(`Voicemail recorded and transcribed from Elena Vance: "Please call back regarding the Q3 neural model deployment window."`);
    }, 4000);
  };

  const handleEndCall = async () => {
    if (!incomingCall) return;
    soundEffects.playBeep();
    const duration = activeCallDuration;
    const caller = incomingCall.callerName;
    const transcript = incomingCall.liveTranscript;
    setIncomingCall(null);

    // Generate post-call summary
    const summaryData = await communicationService.generateCallSummary(caller, duration, transcript);
    
    // Add call to message log
    const callLogItem: MessageItem = {
      id: 'call-log-' + Date.now(),
      sender: caller,
      senderHandle: incomingCall.callerHandle,
      source: 'phone_call',
      callType: 'incoming',
      callDurationSec: duration,
      content: `Call Summary (${Math.round(duration)}s): ${summaryData.summary}`,
      timestamp: 'Just now',
      unread: false,
      priority: 'standard',
      isVip: true,
      suggestedReply: `Send SMS to ${caller}: "Thank you for the sync."`
    };

    const updated = [callLogItem, ...messages];
    onUpdateMessages(updated);
    storageService.saveMessages(updated);

    onSpeak(summaryData.spokenBriefing);
  };

  // Summarize Facebook Messenger Group Chat
  const handleSummarizeGroup = async (msg: MessageItem) => {
    if (!msg.recentGroupMessages || !msg.groupName) return;
    setIsSummarizingGroup(true);
    soundEffects.playActivate();
    onSpeak(`Analyzing 24 hours of ${msg.groupName} conversation logs with Gemini Intelligence.`);

    const summary = await communicationService.summarizeGroupChat(msg.groupName, msg.recentGroupMessages);
    setGroupSummaryData({
      groupName: msg.groupName,
      ...summary
    });
    setIsSummarizingGroup(false);
    onSpeak(summary.spokenBriefing);
  };

  // Handle New Outbound Compose
  const handleSendCompose = () => {
    if (!composeRecipient.trim() || !composeBody.trim()) return;
    soundEffects.playAcknowledge();

    const newMsg: MessageItem = {
      id: 'msg-out-' + Date.now(),
      sender: composeRecipient,
      senderHandle: composeRecipient,
      source: composeChannel,
      content: composeBody,
      timestamp: 'Just now',
      unread: false,
      priority: 'standard',
      extractedEntities: communicationService.extractEntities(composeBody)
    };

    if (composeChannel === 'sms') {
      communicationService.sendSMS(composeRecipient, composeBody);
    } else if (composeChannel === 'viber') {
      communicationService.sendViberMessage(composeRecipient, composeBody);
    } else if (composeChannel === 'messenger') {
      communicationService.sendMessengerMessage(composeRecipient, composeBody);
    } else {
      communicationService.initiatePhoneCall(composeRecipient);
    }

    const updated = [newMsg, ...messages];
    onUpdateMessages(updated);
    storageService.saveMessages(updated);

    setIsComposeOpen(false);
    setComposeRecipient('');
    setComposeBody('');
    onSpeak(`Message dispatched to ${composeRecipient} via ${composeChannel.toUpperCase()}.`);
  };

  return (
    <div className="bg-zinc-950/80 border border-zinc-800/90 rounded-2xl p-4 sm:p-6 backdrop-blur-md flex flex-col space-y-5">
      {/* Header with Unified Channel Metrics */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800/80 pb-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-sky-500/10 border border-sky-500/20 rounded-xl">
              <PhoneCall className="w-5 h-5 text-sky-400" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-semibold text-zinc-100 font-mono">
                  Unified Communications & Telephony
                </h2>
                <span className="px-2 py-0.5 bg-emerald-950/70 border border-emerald-500/30 text-emerald-300 text-[10px] rounded-full font-mono font-medium">
                  Live Dispatch
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                SMS, Viber, Facebook Messenger, Phone Calls & Gmail with Auto-Screener
              </p>
            </div>
          </div>
        </div>

        {/* Quick Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Communication Digest Voice Briefing */}
          <button
            onClick={handlePlayDigest}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-mono font-medium transition-all shadow-[0_0_12px_rgba(14,165,233,0.3)] cursor-pointer"
            title="Read Unified Communication Audio Digest"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Voice Digest</span>
          </button>

          {/* Test Call Screener Simulation */}
          <button
            onClick={handleSimulateIncomingCall}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs text-zinc-300 font-mono transition-all cursor-pointer"
            title="Simulate Incoming Phone Call Screener"
          >
            <PhoneIncoming className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Simulate Call</span>
          </button>

          {/* Compose Outbound */}
          <button
            onClick={() => setIsComposeOpen(true)}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs text-zinc-300 font-mono transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-sky-400" />
            <span>Compose</span>
          </button>

          {/* Settings & DND Drawer Toggle */}
          <button
            onClick={() => setShowSettingsDrawer(!showSettingsDrawer)}
            className={`p-2 rounded-xl border text-xs font-mono transition-all cursor-pointer ${
              commSettings.dndMode !== 'off'
                ? 'bg-amber-950/60 border-amber-500/50 text-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.2)]'
                : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-zinc-400 hover:text-white'
            }`}
            title="Communications Preferences & DND Filtering"
          >
            <Sliders className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* DND & Driving Mode Status Bar (When Active) */}
      {commSettings.dndMode !== 'off' && (
        <div className="flex items-center justify-between p-3 rounded-xl bg-amber-950/40 border border-amber-500/40 text-amber-200 text-xs font-mono">
          <div className="flex items-center space-x-2.5">
            {commSettings.dndMode === 'driving' ? (
              <Car className="w-4 h-4 text-amber-400 animate-pulse" />
            ) : (
              <Moon className="w-4 h-4 text-amber-400" />
            )}
            <div>
              <span className="font-semibold uppercase tracking-wider">
                {commSettings.dndMode === 'driving' ? 'Driving Mode (Hands-Free Speech)' : 'Meeting Mode (Emergency Breakthrough Only)'}
              </span>
              <p className="text-[11px] text-amber-300/80">
                {commSettings.dndMode === 'driving'
                  ? 'Incoming SMS & Viber will be read aloud automatically'
                  : 'Auto-Responder active. Only VIP contacts and emergency terms will alert you.'}
              </p>
            </div>
          </div>
          <button
            onClick={() => handleUpdateSettings({ ...commSettings, dndMode: 'off' })}
            className="px-2.5 py-1 rounded-lg bg-amber-900/60 hover:bg-amber-800 text-[11px] text-amber-100 border border-amber-700/50 cursor-pointer"
          >
            Turn Off
          </button>
        </div>
      )}

      {/* Incoming Call Screener Banner (Overlay / Modal) */}
      <AnimatePresence>
        {incomingCall && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.96 }}
            className="p-5 rounded-2xl bg-zinc-900 border-2 border-sky-500/60 shadow-[0_0_30px_rgba(14,165,233,0.3)] relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-3 flex items-center space-x-2">
              <span className="px-2 py-0.5 rounded-full bg-sky-950 text-sky-300 border border-sky-500/40 text-[10px] font-mono animate-pulse">
                {incomingCall.state === 'ringing' ? 'INCOMING CELLULAR' : incomingCall.state === 'connected' ? `CONNECTED (${activeCallDuration}s)` : 'VOICEMAIL RECORDING'}
              </span>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center space-x-4">
                <div className="relative">
                  <div className="w-12 h-12 rounded-2xl bg-sky-500/20 border border-sky-500/40 flex items-center justify-center">
                    <Phone className="w-6 h-6 text-sky-400 animate-bounce" />
                  </div>
                  <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-400 border-2 border-zinc-900" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-base font-semibold text-zinc-100">{incomingCall.callerName}</h3>
                    <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-mono">
                      VIP Contact
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 font-mono">{incomingCall.callerHandle}</p>
                </div>
              </div>

              {/* Call Screener Action Controls */}
              <div className="flex flex-wrap items-center gap-2">
                {incomingCall.state === 'ringing' ? (
                  <>
                    <button
                      onClick={handleAnswerCall}
                      className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-mono font-medium shadow-[0_0_12px_rgba(16,185,129,0.3)] transition-all cursor-pointer"
                    >
                      <Phone className="w-4 h-4" />
                      <span>Answer</span>
                    </button>
                    <button
                      onClick={handleSendCallVoicemail}
                      className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-mono transition-all cursor-pointer"
                    >
                      <PhoneForwarded className="w-3.5 h-3.5 text-purple-400" />
                      <span>Voicemail</span>
                    </button>
                    <button
                      onClick={handleDeclineCall}
                      className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-rose-950/80 hover:bg-rose-900 border border-rose-800/60 text-rose-300 text-xs font-mono transition-all cursor-pointer"
                    >
                      <PhoneOff className="w-3.5 h-3.5" />
                      <span>Decline</span>
                    </button>
                  </>
                ) : incomingCall.state === 'connected' ? (
                  <button
                    onClick={handleEndCall}
                    className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-mono font-medium shadow-[0_0_12px_rgba(244,63,94,0.3)] transition-all cursor-pointer"
                  >
                    <PhoneOff className="w-4 h-4" />
                    <span>End & Summarize Call</span>
                  </button>
                ) : (
                  <button
                    onClick={() => setIncomingCall(null)}
                    className="px-3 py-1.5 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-mono"
                  >
                    Close Voicemail
                  </button>
                )}
              </div>
            </div>

            {/* Live Audio Transcript Screen */}
            {incomingCall.state !== 'ringing' && (
              <div className="mt-4 p-3 rounded-xl bg-zinc-950 border border-zinc-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] text-zinc-400 font-mono flex items-center space-x-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Live Neural Speech Diarization:</span>
                  </span>
                  <span className="text-[10px] text-sky-400 font-mono">142ms Latency</span>
                </div>
                <div className="space-y-1.5 text-xs text-zinc-300">
                  {incomingCall.liveTranscript.map((t, idx) => (
                    <p key={idx} className="font-mono leading-relaxed">{t}</p>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navigation Filter Tabs & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Channel Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { id: 'all', label: 'All Channels', count: unreadTotal },
            { id: 'urgent', label: 'VIP / Urgent', count: unreadUrgent },
            { id: 'sms', label: 'SMS & OTPs', count: unreadSMS },
            { id: 'viber', label: 'Viber', count: unreadViber },
            { id: 'messenger', label: 'Messenger', count: unreadMessenger },
            { id: 'phone_call', label: 'Phone Calls', count: unreadCalls },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setSelectedChannel(tab.id as any)}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-mono transition-all cursor-pointer ${
                selectedChannel === tab.id
                  ? 'bg-zinc-800 text-sky-300 border border-sky-500/40 shadow-sm font-semibold'
                  : 'bg-zinc-900/60 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 border border-zinc-800/80'
              }`}
            >
              <span>{tab.label}</span>
              {tab.count > 0 && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  tab.id === 'urgent' ? 'bg-rose-500/30 text-rose-300' : 'bg-sky-500/20 text-sky-300'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Search Bar */}
        <div className="relative min-w-[200px]">
          <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search communications..."
            className="w-full pl-8 pr-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-sky-500"
          />
        </div>
      </div>

      {/* Main Messages Grid & Detail View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Message Feed */}
        <div className="lg:col-span-7 space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
          {filteredMessages.length === 0 ? (
            <div className="p-8 text-center rounded-2xl bg-zinc-900/30 border border-zinc-800/60">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2 opacity-80" />
              <p className="text-xs text-zinc-300 font-medium">All clear in this channel</p>
              <p className="text-[11px] text-zinc-500 mt-1">No pending unread communications found</p>
            </div>
          ) : (
            filteredMessages.map((msg) => (
              <div
                key={msg.id}
                onClick={() => handleSelectMessage(msg)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer relative ${
                  selectedMsg?.id === msg.id
                    ? 'bg-zinc-900 border-sky-500/60 shadow-[0_0_20px_rgba(14,165,233,0.15)]'
                    : msg.unread
                    ? 'bg-zinc-900/90 border-zinc-700/80 hover:border-zinc-500'
                    : 'bg-zinc-900/30 border-zinc-800/60 opacity-85 hover:opacity-100'
                }`}
              >
                {/* Header Row */}
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center space-x-2">
                    <span className={`w-2 h-2 rounded-full ${msg.unread ? 'bg-sky-400' : 'bg-transparent'}`} />
                    <span className="text-xs font-semibold text-zinc-100">{msg.sender}</span>
                    
                    {/* Channel Badge */}
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase font-semibold ${
                      msg.source === 'sms'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : msg.source === 'viber'
                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                        : msg.source === 'messenger'
                        ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                        : msg.source === 'phone_call'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        : 'bg-zinc-800 text-zinc-300'
                    }`}>
                      {msg.source === 'phone_call' ? 'Call' : msg.source}
                    </span>

                    {/* VIP / Urgent Badge */}
                    {msg.isVip && (
                      <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[10px] font-mono">
                        VIP
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-zinc-500 font-mono">{msg.timestamp}</span>
                </div>

                {/* Group Chat Marker */}
                {msg.isGroupChat && (
                  <div className="flex items-center space-x-1.5 mb-1 text-[11px] text-sky-400 font-mono">
                    <MessageSquare className="w-3 h-3" />
                    <span>Group: {msg.groupName} ({msg.groupMembers?.length} members)</span>
                  </div>
                )}

                {/* Subject (if applicable) */}
                {msg.subject && (
                  <p className="text-xs font-medium text-zinc-200 mb-1 truncate">{msg.subject}</p>
                )}

                {/* Content */}
                <p className="text-xs text-zinc-400 leading-relaxed line-clamp-2">{msg.content}</p>

                {/* Smart Extracted Entity Badges */}
                {msg.extractedEntities && (
                  <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                    {/* OTP Code Badge */}
                    {msg.extractedEntities.otpCode && (
                      <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-emerald-950/70 border border-emerald-500/40 text-emerald-300 text-[11px] font-mono">
                        <span>OTP: {msg.extractedEntities.otpCode}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopyOtp(msg.extractedEntities!.otpCode!);
                          }}
                          className="hover:text-white transition-colors cursor-pointer"
                          title="Copy OTP Code"
                        >
                          {copiedOtp === msg.extractedEntities.otpCode ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    )}

                    {/* Physical Address Badge */}
                    {msg.extractedEntities.address && (
                      <div className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-sky-950/70 border border-sky-500/40 text-sky-300 text-[11px] font-mono">
                        <MapPin className="w-3 h-3" />
                        <span className="truncate max-w-[200px]">{msg.extractedEntities.address}</span>
                      </div>
                    )}

                    {/* Appointment Time Badge */}
                    {msg.extractedEntities.appointmentTime && (
                      <div className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-purple-950/70 border border-purple-500/40 text-purple-300 text-[11px] font-mono">
                        <CalendarIcon className="w-3 h-3" />
                        <span>{msg.extractedEntities.appointmentTime}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Item Action Bar */}
                <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-zinc-800/70 text-[11px]">
                  <div className="flex items-center space-x-3">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleReadAloud(msg);
                      }}
                      className="text-sky-400 hover:text-sky-300 flex items-center space-x-1 font-mono transition-colors cursor-pointer"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>Read Aloud</span>
                    </button>

                    {msg.isGroupChat && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSummarizeGroup(msg);
                        }}
                        className="text-purple-400 hover:text-purple-300 flex items-center space-x-1 font-mono transition-colors cursor-pointer"
                      >
                        <Layers className="w-3 h-3" />
                        <span>Summarize 24h</span>
                      </button>
                    )}

                    {msg.source === 'phone_call' && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCallContact(msg.sender, msg.senderHandle);
                        }}
                        className="text-emerald-400 hover:text-emerald-300 flex items-center space-x-1 font-mono transition-colors cursor-pointer"
                      >
                        <Phone className="w-3 h-3" />
                        <span>Call Back</span>
                      </button>
                    )}
                  </div>

                  <span className="text-zinc-500 font-mono text-[10px]">
                    Click to Open & Reply →
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Right Column: Active Conversation & Smart Reply Engine */}
        <div className="lg:col-span-5">
          {selectedMsg ? (
            <div className="p-5 rounded-2xl bg-zinc-900 border border-sky-500/40 flex flex-col justify-between h-full space-y-4">
              <div>
                {/* Header with platform launcher */}
                <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                  <div>
                    <div className="flex items-center space-x-2">
                      <h4 className="text-sm font-semibold text-zinc-100">{selectedMsg.sender}</h4>
                      <span className="px-2 py-0.5 bg-zinc-800 text-[10px] rounded text-sky-400 font-mono uppercase">
                        {selectedMsg.source}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-400 font-mono">{selectedMsg.senderHandle}</p>
                  </div>

                  <div className="flex items-center space-x-1.5">
                    {/* Launch native channel button */}
                    {selectedMsg.source === 'viber' && (
                      <button
                        onClick={() => communicationService.sendViberMessage(selectedMsg.senderHandle, '')}
                        className="p-1.5 rounded-lg bg-purple-950 text-purple-300 border border-purple-700/50 hover:bg-purple-900 text-xs"
                        title="Open Viber App"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {selectedMsg.source === 'messenger' && (
                      <button
                        onClick={() => communicationService.sendMessengerMessage(selectedMsg.senderHandle, '')}
                        className="p-1.5 rounded-lg bg-blue-950 text-blue-300 border border-blue-700/50 hover:bg-blue-900 text-xs"
                        title="Open Messenger"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {selectedMsg.source === 'phone_call' && (
                      <button
                        onClick={() => handleCallContact(selectedMsg.sender, selectedMsg.senderHandle)}
                        className="p-1.5 rounded-lg bg-emerald-950 text-emerald-300 border border-emerald-700/50 hover:bg-emerald-900 text-xs"
                        title="Dial Contact"
                      >
                        <Phone className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => setSelectedMsg(null)}
                      className="p-1.5 text-zinc-500 hover:text-zinc-300 text-xs"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* Message Body Content */}
                <div className="my-3 p-3.5 rounded-xl bg-zinc-950/80 border border-zinc-800/80 text-xs text-zinc-300 leading-relaxed font-mono">
                  {selectedMsg.content}
                </div>

                {/* Smart Reply Suggestions (AI Context Aware) */}
                <div className="space-y-2 mb-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-zinc-400 font-mono flex items-center space-x-1">
                      <Sparkles className="w-3 h-3 text-sky-400" />
                      <span>Context-Aware Smart Replies:</span>
                    </span>
                    {isGeneratingReplies && (
                      <RefreshCw className="w-3 h-3 text-sky-400 animate-spin" />
                    )}
                  </div>

                  <div className="space-y-1.5">
                    {smartReplies.map((reply, idx) => (
                      <button
                        key={idx}
                        onClick={() => setReplyText(reply)}
                        className="w-full text-left p-2.5 rounded-xl bg-zinc-950/60 hover:bg-sky-950/40 border border-zinc-800 hover:border-sky-500/40 text-xs text-zinc-300 transition-all font-mono leading-relaxed cursor-pointer"
                      >
                        "{reply}"
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Reply Dispatcher Box */}
              <div className="space-y-2 pt-2 border-t border-zinc-800">
                <textarea
                  rows={2}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder={`Draft reply via ${selectedMsg.source.toUpperCase()}...`}
                  className="w-full p-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-200 focus:outline-none focus:border-sky-500 resize-none font-mono"
                />

                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-zinc-500 font-mono">
                    Voice & Intent Dispatch
                  </span>
                  <button
                    onClick={() => handleDispatchReply(selectedMsg, replyText)}
                    className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-mono font-medium rounded-xl flex items-center space-x-1.5 transition-all shadow-[0_0_10px_rgba(14,165,233,0.25)] cursor-pointer"
                  >
                    {dispatchedSuccessId === selectedMsg.id ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                        <span>Dispatched!</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span>Send on {selectedMsg.source.toUpperCase()}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center rounded-2xl bg-zinc-900/30 border border-zinc-800/60 flex flex-col items-center justify-center h-full min-h-[300px]">
              <Mail className="w-10 h-10 text-zinc-600 mb-3" />
              <h4 className="text-xs font-semibold text-zinc-300 font-mono">Select a Communication</h4>
              <p className="text-[11px] text-zinc-500 mt-1 max-w-xs leading-relaxed">
                Click any message or phone log to review details, extract OTPs, or send context-aware smart replies.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Group Chat Summarizer Modal / Drawer */}
      <AnimatePresence>
        {groupSummaryData && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4"
          >
            <div className="bg-zinc-900 border border-purple-500/50 rounded-2xl p-6 max-w-xl w-full space-y-4 shadow-[0_0_30px_rgba(168,85,247,0.25)]">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                <div className="flex items-center space-x-2">
                  <MessageSquare className="w-5 h-5 text-purple-400" />
                  <h3 className="text-sm font-semibold text-zinc-100 font-mono">
                    24h Executive Summary: {groupSummaryData.groupName}
                  </h3>
                </div>
                <button
                  onClick={() => setGroupSummaryData(null)}
                  className="text-zinc-400 hover:text-white text-sm"
                >
                  ✕
                </button>
              </div>

              {/* 3-Sentence Summary */}
              <div className="p-4 rounded-xl bg-zinc-950 border border-purple-500/30 text-xs text-zinc-200 leading-relaxed font-mono">
                <p className="text-purple-300 font-semibold mb-1 text-[11px] uppercase tracking-wider">
                  Executive Briefing (3 Sentences)
                </p>
                {groupSummaryData.threeSentenceSummary}
              </div>

              {/* Key Decisions & Actions */}
              <div className="space-y-3">
                <div>
                  <h5 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider font-mono mb-1.5">
                    Key Decisions
                  </h5>
                  <ul className="space-y-1 text-xs text-zinc-300 font-mono">
                    {groupSummaryData.keyDecisions.map((dec, i) => (
                      <li key={i} className="flex items-center space-x-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                        <span>{dec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-zinc-800">
                <button
                  onClick={() => onSpeak(groupSummaryData.spokenBriefing)}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-purple-950/80 hover:bg-purple-900 border border-purple-700/50 text-purple-300 text-xs font-mono"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>Replay Voice Summary</span>
                </button>
                <button
                  onClick={() => setGroupSummaryData(null)}
                  className="px-4 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-mono rounded-xl"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Communications Preferences & DND Drawer */}
      <AnimatePresence>
        {showSettingsDrawer && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 15 }}
            className="p-5 rounded-2xl bg-zinc-900/95 border border-zinc-700/80 space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center space-x-2">
                <Sliders className="w-4 h-4 text-sky-400" />
                <h3 className="text-xs font-semibold text-zinc-100 font-mono uppercase tracking-wider">
                  Communications & DND Filtering Preferences
                </h3>
              </div>
              <button
                onClick={() => setShowSettingsDrawer(false)}
                className="text-xs text-zinc-500 hover:text-zinc-300"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* DND Mode Selector */}
              <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2">
                <span className="text-xs font-semibold text-zinc-300 font-mono">Notification Mode</span>
                <div className="space-y-1.5">
                  {[
                    { id: 'off', label: 'Normal (All Notifications)' },
                    { id: 'meeting', label: 'Meeting Mode (VIP & Emergency Only)' },
                    { id: 'driving', label: 'Driving Mode (Hands-Free Speech)' }
                  ].map(m => (
                    <button
                      key={m.id}
                      onClick={() => handleUpdateSettings({ ...commSettings, dndMode: m.id as any })}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-mono transition-all ${
                        commSettings.dndMode === m.id
                          ? 'bg-sky-600 text-white font-medium'
                          : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Auto-Responder Template */}
              <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2">
                <span className="text-xs font-semibold text-zinc-300 font-mono">Meeting Auto-Responder Text</span>
                <textarea
                  rows={3}
                  value={commSettings.autoResponderTemplate}
                  onChange={(e) => handleUpdateSettings({ ...commSettings, autoResponderTemplate: e.target.value })}
                  className="w-full p-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-300 focus:outline-none focus:border-sky-500 resize-none font-mono"
                />
              </div>

              {/* VIP Contacts & Emergency Keywords */}
              <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2 text-xs font-mono">
                <span className="font-semibold text-zinc-300">Breakthrough Rules</span>
                <p className="text-[11px] text-zinc-400">
                  VIP Contacts: <span className="text-sky-300">{commSettings.vipContacts.join(', ')}</span>
                </p>
                <p className="text-[11px] text-zinc-400">
                  Emergency Triggers: <span className="text-amber-300">{commSettings.emergencyKeywords.join(', ')}</span>
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Outbound Compose Modal */}
      <AnimatePresence>
        {isComposeOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4"
          >
            <div className="bg-zinc-900 border border-sky-500/50 rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-[0_0_30px_rgba(14,165,233,0.25)]">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                <div className="flex items-center space-x-2">
                  <Send className="w-4 h-4 text-sky-400" />
                  <h3 className="text-sm font-semibold text-zinc-100 font-mono">
                    Compose Outbound Communication
                  </h3>
                </div>
                <button
                  onClick={() => setIsComposeOpen(false)}
                  className="text-zinc-400 hover:text-white text-sm"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3">
                {/* Channel Selector */}
                <div>
                  <label className="text-xs text-zinc-400 font-mono block mb-1.5">Dispatch Channel</label>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { id: 'sms', label: 'SMS Text' },
                      { id: 'viber', label: 'Viber' },
                      { id: 'messenger', label: 'Messenger' },
                      { id: 'phone_call', label: 'Voice Call' },
                    ].map(ch => (
                      <button
                        key={ch.id}
                        type="button"
                        onClick={() => setComposeChannel(ch.id as any)}
                        className={`py-1.5 rounded-xl text-xs font-mono font-medium transition-all ${
                          composeChannel === ch.id
                            ? 'bg-sky-600 text-white'
                            : 'bg-zinc-950 text-zinc-400 border border-zinc-800'
                        }`}
                      >
                        {ch.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Recipient */}
                <div>
                  <label className="text-xs text-zinc-400 font-mono block mb-1.5">Recipient (Name / Number / Handle)</label>
                  <input
                    type="text"
                    value={composeRecipient}
                    onChange={(e) => setComposeRecipient(e.target.value)}
                    placeholder="e.g. John Vance or +1 (555) 019-2834"
                    className="w-full p-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-200 focus:outline-none focus:border-sky-500 font-mono"
                  />
                </div>

                {/* Message Body */}
                {composeChannel !== 'phone_call' && (
                  <div>
                    <label className="text-xs text-zinc-400 font-mono block mb-1.5">Message Content</label>
                    <textarea
                      rows={3}
                      value={composeBody}
                      onChange={(e) => setComposeBody(e.target.value)}
                      placeholder="Type or dictate message..."
                      className="w-full p-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-200 focus:outline-none focus:border-sky-500 resize-none font-mono"
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsComposeOpen(false)}
                  className="px-4 py-2 bg-zinc-800 text-zinc-300 text-xs font-mono rounded-xl hover:bg-zinc-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSendCompose}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-mono font-medium rounded-xl flex items-center space-x-1.5 shadow-[0_0_12px_rgba(14,165,233,0.3)]"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{composeChannel === 'phone_call' ? 'Initiate Call' : 'Authorize & Dispatch'}</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
