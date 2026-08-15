import { 
  ConversationTurn, 
  ReminderItem, 
  CalendarEvent, 
  ActiveTimer, 
  MessageItem, 
  MeetingSession, 
  PrivacyAuditEntry, 
  VoiceSettings, 
  CommunicationSettings,
  HabitPattern,
  ContactRelationship,
  CrossDeviceSyncState,
  AuditLogEntry,
  ProactiveSuggestion,
  VoiceEmotionProfile,
  VoicePersonaOption
} from '../types/friday';

const STORAGE_KEYS = {
  SETTINGS: 'friday_voice_settings_v2',
  CONVERSATIONS: 'friday_conv_history_v2',
  REMINDERS: 'friday_reminders_v2',
  CALENDAR: 'friday_calendar_v2',
  MESSAGES: 'friday_messages_v3',
  COMM_SETTINGS: 'friday_comm_settings_v1',
  MEETINGS: 'friday_meetings_v2',
  TIMERS: 'friday_timers_v2',
  AUDIT: 'friday_privacy_audit_v2',
  HABITS: 'friday_habits_v1',
  RELATIONSHIPS: 'friday_relationships_v1',
  SYNC_STATE: 'friday_sync_state_v1',
  PROACTIVE_SUGGESTIONS: 'friday_proactive_suggestions_v1',
  DAILY_AUDIT_LOGS: 'friday_daily_audit_logs_v1',
  VOICE_PERSONAS: 'friday_voice_personas_v1',
  USER_PREFERENCES_MEMORY: 'friday_user_pref_memory_v1'
};

export const DEFAULT_HABITS: HabitPattern[] = [
  {
    id: 'habit-1',
    title: 'Friday 4:00 PM Meeting Block',
    type: 'calendar',
    confidenceScore: 94,
    description: 'You have cancelled or rescheduled 85% of meetings scheduled on Friday after 4:00 PM over the last 6 weeks.',
    triggerCondition: 'Friday after 3:30 PM',
    suggestedAction: 'Automatically reserve Friday 4:00 PM – 6:00 PM for Executive Decompression & Weekly Review.',
    occurrenceCount: 7,
    acceptedCount: 5,
    dismissedCount: 1,
    status: 'active',
    lastObservedAt: Date.now() - 86400000 * 3,
    voicePrompt: 'You always cancel Friday 4 PM meetings. Shall I start blocking that time as focus review?'
  },
  {
    id: 'habit-2',
    title: 'Sunday Evening Family Call',
    type: 'communication',
    confidenceScore: 98,
    description: 'Weekly voice call placed to Mom every Sunday between 5:30 PM and 6:30 PM.',
    triggerCondition: 'Sunday at 6:00 PM',
    suggestedAction: 'Prompt to initiate voice call to Mom if no interaction logged by 6:00 PM Sunday.',
    occurrenceCount: 12,
    acceptedCount: 11,
    dismissedCount: 0,
    status: 'active',
    lastObservedAt: Date.now() - 86400000 * 5,
    voicePrompt: "You usually call your mom on Sundays. It's 6 PM — want me to dial?"
  },
  {
    id: 'habit-3',
    title: 'Mid-Day Workout Rebalancing',
    type: 'health',
    confidenceScore: 88,
    description: 'Workout frequency drops when meetings exceed 5 hours/day. Flag whenever workout gap reaches 3 days.',
    triggerCondition: 'Workout gap >= 3 days and afternoon slot free',
    suggestedAction: 'Protect free 2:00 PM – 3:00 PM slot for fitness session before high-stress review.',
    occurrenceCount: 4,
    acceptedCount: 3,
    dismissedCount: 1,
    status: 'active',
    lastObservedAt: Date.now() - 86400000 * 2,
    voicePrompt: "You haven't worked out in 3 days. Your 2 PM slot is free — want me to block 45 minutes?"
  },
  {
    id: 'habit-4',
    title: 'Pre-Meeting Material Auto-Assembly',
    type: 'executive',
    confidenceScore: 96,
    description: 'You review previous action items and sent decks within 15 minutes of executive board meetings.',
    triggerCondition: '15 minutes before any executive meeting',
    suggestedAction: 'Auto-surface last meeting minutes, pending deliverables, and attendee briefing cards.',
    occurrenceCount: 18,
    acceptedCount: 17,
    dismissedCount: 0,
    status: 'active',
    lastObservedAt: Date.now() - 3600000 * 2,
    voicePrompt: "You are meeting with Acme Corp in 10 minutes. Last meeting they asked for the Q3 budget deck — I have it ready."
  }
];

export const DEFAULT_RELATIONSHIPS: ContactRelationship[] = [
  {
    id: 'rel-1',
    contactName: 'Sarah Jenkins',
    email: 'sarah.j@enterprise.com',
    phone: '+1 (555) 238-9901',
    organization: 'Enterprise AI Labs',
    importanceScore: 92,
    lastInteractedAt: Date.now() - 86400000 * 21, // 3 weeks ago
    recommendedCadenceDays: 14,
    relationshipStatus: 'needs_attention',
    lastChannel: 'gmail',
    notes: 'Key collaborator on neural architecture. Sent message 24 hours ago.',
    suggestedNudge: "You haven't spoken to Sarah in 3 weeks. She sent a budget message yesterday. Shall I draft a reply?"
  },
  {
    id: 'rel-2',
    contactName: 'Demo User 2',
    email: 'user2@example.com',
    phone: '+1 (555) 991-0021',
    organization: 'Demo Enterprise',
    importanceScore: 100,
    lastInteractedAt: Date.now() - 3600000 * 3,
    recommendedCadenceDays: 1,
    relationshipStatus: 'healthy',
    lastChannel: 'messenger',
    notes: 'Executive alignment & strategic logistics.'
  },
  {
    id: 'rel-3',
    contactName: 'Elena Vance (VP AI Strategy)',
    email: 'elena.vance@quantumneural.ai',
    phone: '+1 (555) 749-1029',
    organization: 'Quantum Neural Systems',
    importanceScore: 95,
    lastInteractedAt: Date.now() - 3600000 * 1,
    recommendedCadenceDays: 3,
    relationshipStatus: 'healthy',
    lastChannel: 'phone_call',
    notes: 'Awaiting neural model deployment window sign-off.'
  },
  {
    id: 'rel-4',
    contactName: 'Dr. Bruce Banner',
    email: 'bruce@gamma-labs.org',
    phone: '+1 (555) 831-4091',
    organization: 'Gamma Research Institute',
    importanceScore: 84,
    lastInteractedAt: Date.now() - 86400000 * 28, // 4 weeks
    recommendedCadenceDays: 20,
    relationshipStatus: 'dormant',
    lastChannel: 'gmail',
    notes: 'Acoustic sensor telemetry collaboration.',
    suggestedNudge: "It has been 4 weeks since you synced with Dr. Banner on sensor telemetry."
  }
];

export const DEFAULT_PROACTIVE_SUGGESTIONS: ProactiveSuggestion[] = [
  {
    id: 'sug-1',
    type: 'morning_briefing',
    title: 'Morning Briefing 2.0 Ready',
    description: '4 meetings scheduled. Heavy traffic alert on FDR Drive for 9:00 AM briefing. 2 urgent emails pending approval.',
    spokenPrompt: 'Good morning. You have 4 meetings. Traffic is heavy to the 9 AM. You have 2 urgent emails. Also, you have not worked out in 3 days — your 2 PM slot is free.',
    actionType: 'play_morning_briefing',
    timestamp: Date.now() - 1800000,
    badge: 'Proactive Briefing'
  },
  {
    id: 'sug-2',
    type: 'habit_block',
    title: 'Friday 4 PM Focus Block Suggestion',
    description: 'Based on 85% cancellation pattern, protect 4:00 PM – 6:00 PM for deep focus.',
    spokenPrompt: 'You always cancel Friday 4 PM meetings. Shall I start blocking that time as deep focus?',
    actionType: 'block_calendar_habit',
    actionPayload: { time: 'Friday 4:00 PM - 6:00 PM', title: 'Focus & Executive Review' },
    timestamp: Date.now() - 3600000 * 2,
    badge: 'Habit Engine'
  },
  {
    id: 'sug-3',
    type: 'predictive_prep',
    title: 'Acme Corp / Budget Review Meeting Prep',
    description: 'Surfaced last meeting minutes, CFO action items, and approved Q3 deck.',
    spokenPrompt: 'You are meeting with Sarah and the board in 10 minutes. Last meeting they requested the budget deck. I have verified and pulled the document.',
    actionType: 'open_meeting_prep',
    timestamp: Date.now() - 3600000 * 4,
    badge: 'Predictive Prep'
  },
  {
    id: 'sug-4',
    type: 'relationship_nudge',
    title: 'Relationship Cadence: Sarah Jenkins',
    description: 'No direct sync in 3 weeks. Urgent budget approval received.',
    spokenPrompt: 'You have not spoken to Sarah in 3 weeks. She sent a message yesterday. Want me to draft an approval reply?',
    actionType: 'reply_relationship_contact',
    actionPayload: { contactId: 'rel-1', name: 'Sarah Jenkins' },
    timestamp: Date.now() - 3600000 * 5,
    badge: 'VIP Cadence'
  }
];

export const DEFAULT_SYNC_STATE: CrossDeviceSyncState = {
  isOnline: true,
  syncStatus: 'synced',
  lastSyncedTimestamp: Date.now() - 12000,
  e2eeKeyFingerprint: 'SHA256: 8f4a9b...7e21cd0 (AES-GCM 256)',
  pendingSyncCount: 0,
  dataResidency: 'eu-central',
  conflictResolutionMode: 'auto_merge',
  connectedDevices: [
    {
      deviceId: 'dev-macbook-pro',
      deviceName: 'Tony’s MacBook Pro 16" (M3 Max)',
      deviceType: 'desktop_mac',
      isOnline: true,
      lastSyncedAt: Date.now() - 8000,
      appVersion: 'v2.6.0-release',
      ipLocation: 'New York, US',
      isCurrentDevice: true
    },
    {
      deviceId: 'dev-iphone-16',
      deviceName: 'Tony’s iPhone 16 Pro Max',
      deviceType: 'mobile_ios',
      isOnline: true,
      lastSyncedAt: Date.now() - 14000,
      appVersion: 'v2.6.0-ios (TestFlight)',
      ipLocation: 'New York, US'
    },
    {
      deviceId: 'dev-wearable-glass',
      deviceName: 'Executive HUD Wearable Core',
      deviceType: 'web',
      isOnline: true,
      lastSyncedAt: Date.now() - 25000,
      appVersion: 'v2.6.0-hud',
      ipLocation: 'Executive Lab'
    }
  ]
};

export const DEFAULT_VOICE_PERSONAS: VoicePersonaOption[] = [
  {
    id: 'persona-friday-classic',
    name: 'FRIDAY Executive (Irish/British)',
    description: 'Impeccably poised, highly competent, calm, and subtly witty executive right hand.',
    accent: 'Irish / British Executive',
    style: 'crisp',
    rate: 1.05,
    pitch: 1.02,
    personality: 'professional'
  },
  {
    id: 'persona-jarvis',
    name: 'JARVIS Tactical Core',
    description: 'Analytical, formal, hyper-precise cadence with tactical telemetry emphasis.',
    accent: 'British Crisp',
    style: 'tactical',
    rate: 1.0,
    pitch: 0.95,
    personality: 'executive'
  },
  {
    id: 'persona-warm-mentor',
    name: 'Warm Executive Advisor',
    description: 'Attentive, conversational, empathetic tone with emotional fatigue adaptation.',
    accent: 'Neutral Atlantic',
    style: 'warm',
    rate: 1.0,
    pitch: 1.0,
    personality: 'warm'
  }
];

export const DEFAULT_DAILY_AUDIT_LOGS: AuditLogEntry[] = [
  {
    id: 'aud-log-1',
    timestamp: Date.now() - 3600000 * 1.5,
    actionType: 'email_sent',
    description: 'Dispatched approved Q3 Budget confirmation email to Sarah Jenkins via Google Workspace API.',
    riskLevel: 'medium',
    biometricVerified: true,
    deviceOrigin: 'MacBook Pro 16"'
  },
  {
    id: 'aud-log-2',
    timestamp: Date.now() - 3600000 * 2.2,
    actionType: 'event_created',
    description: 'Created calendar focus block "Executive Focus: Q3 Review" on Google Calendar.',
    riskLevel: 'low',
    biometricVerified: false,
    deviceOrigin: 'FRIDAY Neural Core'
  },
  {
    id: 'aud-log-3',
    timestamp: Date.now() - 3600000 * 3.1,
    actionType: 'e2ee_sync',
    description: 'Synchronized encrypted conversation memories and calendar across 3 verified devices.',
    riskLevel: 'low',
    biometricVerified: false,
    deviceOrigin: 'WebSocket Sync Node'
  },
  {
    id: 'aud-log-4',
    timestamp: Date.now() - 3600000 * 4.5,
    actionType: 'call_screened',
    description: 'Auto-screened incoming cellular call from Elena Vance and generated acoustic summary.',
    riskLevel: 'low',
    biometricVerified: false,
    deviceOrigin: 'iPhone 16 Pro'
  }
];

export const DEFAULT_COMMUNICATION_SETTINGS: CommunicationSettings = {
  dndMode: 'off',
  autoResponderEnabled: true,
  autoResponderTemplate: "FRIDAY Auto-Responder: Tony is currently unavailable in an executive session. I am monitoring for critical emergencies.",
  drivingModeHandsFree: false,
  emergencyKeywords: ['urgent', 'emergency', 'asap', 'critical', 'hospital', 'code red', 'immediately'],
  vipContacts: ['Pepper Potts', 'Mom', 'Sarah Jenkins', 'Elena Vance', 'Board Director'],
  announceIncomingCalls: true,
  announceIncomingSMS: true,
  viberConnected: true,
  messengerConnected: true,
  telephonyConnected: true
};

export const DEFAULT_SETTINGS: VoiceSettings = {
  wakeWord: 'Hey Ahri',
  isWakeWordEnabled: true,
  voiceName: '',
  rate: 1.05,
  pitch: 1.0,
  volume: 1.0,
  personality: 'professional',
  continuousListening: true,
  bargeInEnabled: true,
  vadSensitivity: 0.7,
  language: 'en-US',
  offlineFallback: true,
  soundEffects: true,
};

const SEED_CALENDAR: CalendarEvent[] = [
  {
    id: 'evt-1',
    title: 'Executive Briefing & Daily Sync',
    startTime: '09:00 AM',
    endTime: '09:45 AM',
    date: 'Today',
    location: 'Conference Room Executive Center / Meet',
    type: 'briefing',
    attendees: ['Executive Team', 'AI Operations']
  },
  {
    id: 'evt-2',
    title: 'Product & Engineering Architecture Review',
    startTime: '11:30 AM',
    endTime: '12:30 PM',
    date: 'Today',
    location: 'Google Meet (Live AI Minutes)',
    type: 'meeting',
    attendees: ['Lead Architect', 'DevOps Team']
  },
  {
    id: 'evt-3',
    title: 'Investor Strategy & Q3 Budget Review',
    startTime: '02:00 PM',
    endTime: '03:00 PM',
    date: 'Today',
    location: 'Executive Boardroom',
    type: 'meeting',
    isConflict: false,
    attendees: ['Board of Directors', 'CFO']
  },
  {
    id: 'evt-4',
    title: 'Flight NY to San Francisco (UA 842)',
    startTime: '06:30 PM',
    endTime: '09:45 PM',
    date: 'Tomorrow',
    location: 'JFK Terminal 7',
    type: 'travel'
  }
];

const SEED_MESSAGES: MessageItem[] = [
  {
    id: 'msg-sms-1',
    sender: 'Mom',
    senderHandle: '+1 (555) 392-8819',
    source: 'sms',
    content: 'Hi Tony, are you coming over for dinner at 7:00 PM tonight? Dad cooked your favorite pasta.',
    timestamp: '4m ago',
    unread: true,
    priority: 'urgent',
    isVip: true,
    extractedEntities: {
      appointmentTime: 'Today at 7:00 PM'
    },
    suggestedReply: "I'll be there at 7:00 PM sharp, Mom! Save me a plate.",
    suggestedReplies: [
      "I'll be there at 7:00 PM sharp, Mom! Save me a plate.",
      "Running slightly late, can we do 7:30 PM instead?",
      "Sending love, caught in a board review but will try my best."
    ]
  },
  {
    id: 'msg-sms-otp',
    sender: 'Cloud Security Center',
    senderHandle: 'SMS: 77209',
    source: 'sms',
    content: 'Your authentication verification code is 849-215. Valid for 10 minutes. Do not share this OTP with anyone.',
    timestamp: '11m ago',
    unread: true,
    priority: 'urgent',
    extractedEntities: {
      otpCode: '849-215'
    },
    suggestedReply: 'Copy Code 849-215'
  },
  {
    id: 'msg-viber-1',
    sender: 'John Vance',
    senderHandle: 'viber://john.vance.arch',
    source: 'viber',
    content: "Hey, I'm heading over to the lab now. Are we still good for the 3:00 PM HUD briefing or should I grab coffee first?",
    timestamp: '18m ago',
    unread: true,
    priority: 'standard',
    isVip: false,
    extractedEntities: {
      appointmentTime: 'Today at 3:00 PM',
      address: '10880 Wilshire Blvd, Los Angeles, CA'
    },
    suggestedReply: "I'll be 10 minutes late, please grab coffee and start the projector.",
    suggestedReplies: [
      "I'll be 10 minutes late, please grab coffee and start the projector.",
      "Yes, on schedule! See you in Conference Room B.",
      "Let us push to 3:30 PM so Sarah can join us."
    ]
  },
  {
    id: 'msg-fb-group',
    sender: 'Executive Operations Group',
    senderHandle: 'fb.me/group/exec-operations',
    source: 'messenger',
    isGroupChat: true,
    groupName: 'Executive Operations & Planning',
    groupMembers: ['Demo User 2', 'Operations Lead', 'Engineering VP', 'Executive User'],
    content: 'Operations: We confirmed the workshop reservation for Saturday. Engineering: I loaded the presentation deck. Logistics: I will set up the demonstration room by 2 PM!',
    timestamp: '35m ago',
    unread: true,
    priority: 'standard',
    recentGroupMessages: [
      { sender: 'Demo User 2', text: 'Confirmed the workshop reservation for this Saturday at 11 AM.', time: '45m ago' },
      { sender: 'Operations Lead', text: 'Schedule cleared. Equipment is prepared and staged.', time: '38m ago' },
      { sender: 'Engineering VP', text: 'I am bringing the demonstration prototypes by 2:00 PM.', time: '35m ago' },
      { sender: 'Logistics Lead', text: 'Meeting room setup is confirmed.', time: '30m ago' }
    ],
    suggestedReply: 'Sounds perfect everyone! The itinerary has been synced.',
    suggestedReplies: [
      'Sounds perfect everyone! The itinerary has been synced.',
      'Make sure the presentation materials are verified too.',
      'Let me know if you need assistance with room setup.'
    ]
  },
  {
    id: 'msg-call-1',
    sender: 'Elena Vance (VP AI Strategy)',
    senderHandle: '+1 (555) 749-1029',
    source: 'phone_call',
    callType: 'missed',
    callDurationSec: 0,
    content: 'Missed Call (1:45 PM) - Left Voicemail: "Tony, calling to confirm our neural model deployment window tonight. Call me back as soon as you are free."',
    timestamp: '42m ago',
    unread: true,
    priority: 'urgent',
    isVip: true,
    voicemailTranscript: "Tony, calling to confirm our neural model deployment window tonight. Call me back as soon as you are free.",
    suggestedReply: 'Dial Elena Vance (+1 555-749-1029)',
    suggestedReplies: [
      'Call Elena Vance back now',
      'Send SMS: "In a session, calling you back in 20 minutes."',
      'Schedule 15m callback at 4:30 PM'
    ]
  },
  {
    id: 'msg-gmail-1',
    sender: 'Sarah Jenkins',
    senderHandle: 'sarah.j@enterprise.com',
    source: 'gmail',
    subject: 'Action Required: Finalized Q3 Budget Deck',
    content: 'Hi Tony, I have finalized the budget figures. We need your approval before 4 PM today so we can circulate to the audit committee.',
    timestamp: '1h ago',
    unread: false,
    priority: 'urgent',
    isVip: true,
    suggestedReply: 'Approved with conditions. Proceed with audit distribution.'
  }
];

const SEED_REMINDERS: ReminderItem[] = [
  {
    id: 'rem-1',
    task: 'Approve finalized Q3 budget deck for Sarah',
    dueTime: 'Today at 3:30 PM',
    priority: 'high',
    completed: false,
    createdAt: Date.now() - 3600000,
    category: 'work'
  },
  {
    id: 'rem-2',
    task: 'Call Mom for her birthday preparation',
    dueTime: 'Today at 5:00 PM',
    priority: 'high',
    completed: false,
    createdAt: Date.now() - 7200000,
    category: 'personal'
  },
  {
    id: 'rem-3',
    task: 'Follow up with design agency on HUD schematics',
    dueTime: 'Tomorrow at 10:00 AM',
    priority: 'medium',
    completed: false,
    createdAt: Date.now() - 14400000,
    category: 'follow-up'
  }
];

export const storageService = {
  getSettings(): VoiceSettings {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      return stored ? { ...DEFAULT_SETTINGS, ...JSON.parse(stored) } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  },

  saveSettings(settings: VoiceSettings): void {
    try {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    } catch (e) {
      console.error('Failed to save settings to localStorage', e);
    }
  },

  getConversations(): ConversationTurn[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.CONVERSATIONS);
      if (!stored) return [];
      const turns: ConversationTurn[] = JSON.parse(stored);
      // Enforce 7-day rolling window
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      return turns.filter(t => t.timestamp > sevenDaysAgo);
    } catch {
      return [];
    }
  },

  saveConversationTurn(turn: ConversationTurn): void {
    try {
      const current = this.getConversations();
      current.push(turn);
      // Keep only last 7 days and cap at 100 items for performance
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const filtered = current.filter(t => t.timestamp > sevenDaysAgo).slice(-100);
      localStorage.setItem(STORAGE_KEYS.CONVERSATIONS, JSON.stringify(filtered));

      // Add to privacy audit log
      this.logAuditEntry({
        category: 'Voice Audio',
        action: `Processed utterance (${turn.role === 'user' ? 'Inbound' : 'Synthesis'})`,
        storageType: 'Local IndexedDB',
        sizeBytes: turn.text.length * 2
      });
    } catch (e) {
      console.error('Failed to save conversation turn', e);
    }
  },

  getReminders(): ReminderItem[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.REMINDERS);
      return stored ? JSON.parse(stored) : SEED_REMINDERS;
    } catch {
      return SEED_REMINDERS;
    }
  },

  saveReminders(reminders: ReminderItem[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.REMINDERS, JSON.stringify(reminders));
    } catch (e) {
      console.error('Failed to save reminders', e);
    }
  },

  getCalendar(): CalendarEvent[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.CALENDAR);
      return stored ? JSON.parse(stored) : SEED_CALENDAR;
    } catch {
      return SEED_CALENDAR;
    }
  },

  saveCalendar(events: CalendarEvent[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.CALENDAR, JSON.stringify(events));
    } catch (e) {
      console.error('Failed to save calendar', e);
    }
  },

  getMessages(): MessageItem[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.MESSAGES);
      return stored ? JSON.parse(stored) : SEED_MESSAGES;
    } catch {
      return SEED_MESSAGES;
    }
  },

  saveMessages(msgs: MessageItem[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(msgs));
    } catch (e) {
      console.error('Failed to save messages', e);
    }
  },

  getCommunicationSettings(): CommunicationSettings {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.COMM_SETTINGS);
      return stored ? { ...DEFAULT_COMMUNICATION_SETTINGS, ...JSON.parse(stored) } : DEFAULT_COMMUNICATION_SETTINGS;
    } catch {
      return DEFAULT_COMMUNICATION_SETTINGS;
    }
  },

  saveCommunicationSettings(settings: CommunicationSettings): void {
    try {
      localStorage.setItem(STORAGE_KEYS.COMM_SETTINGS, JSON.stringify(settings));
    } catch (e) {
      console.error('Failed to save communication settings', e);
    }
  },

  getTimers(): ActiveTimer[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.TIMERS);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  },

  saveTimers(timers: ActiveTimer[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.TIMERS, JSON.stringify(timers));
    } catch (e) {
      console.error('Failed to save timers', e);
    }
  },

  getAuditLog(): PrivacyAuditEntry[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.AUDIT);
      if (!stored) {
        return [
          {
            id: 'aud-1',
            timestamp: Date.now() - 3600000,
            category: 'Voice Audio',
            action: 'Continuous microphone stream processed via on-device VAD',
            storageType: 'Ephemeral',
            sizeBytes: 48000
          },
          {
            id: 'aud-2',
            timestamp: Date.now() - 1800000,
            category: 'Transcript',
            action: 'Encrypted 7-day conversation history stored in local database',
            storageType: 'Local IndexedDB',
            sizeBytes: 1240
          },
          {
            id: 'aud-3',
            timestamp: Date.now() - 600000,
            category: 'Calendar Access',
            action: 'Checked schedule conflicts for 02:00 PM appointment',
            storageType: 'In-Memory Encrypted',
            sizeBytes: 520
          }
        ];
      }
      return JSON.parse(stored);
    } catch {
      return [];
    }
  },

  logAuditEntry(entry: Omit<PrivacyAuditEntry, 'id' | 'timestamp'>): void {
    try {
      const current = this.getAuditLog();
      const newEntry: PrivacyAuditEntry = {
        ...entry,
        id: 'aud-' + Math.random().toString(36).substring(2, 9),
        timestamp: Date.now()
      };
      current.unshift(newEntry);
      localStorage.setItem(STORAGE_KEYS.AUDIT, JSON.stringify(current.slice(0, 50)));
    } catch (e) {
      console.error('Failed to log audit entry', e);
    }
  },

  exportAllDataJSON(): string {
    const backup = {
      exportedAt: new Date().toISOString(),
      version: '2.4.0',
      settings: this.getSettings(),
      conversations: this.getConversations(),
      reminders: this.getReminders(),
      calendar: this.getCalendar(),
      messages: this.getMessages(),
      audit: this.getAuditLog()
    };
    return JSON.stringify(backup, null, 2);
  },

  getHabits(): HabitPattern[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.HABITS);
      return stored ? JSON.parse(stored) : DEFAULT_HABITS;
    } catch {
      return DEFAULT_HABITS;
    }
  },

  saveHabits(habits: HabitPattern[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.HABITS, JSON.stringify(habits));
    } catch (e) {
      console.error('Failed to save habits', e);
    }
  },

  getRelationships(): ContactRelationship[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.RELATIONSHIPS);
      return stored ? JSON.parse(stored) : DEFAULT_RELATIONSHIPS;
    } catch {
      return DEFAULT_RELATIONSHIPS;
    }
  },

  saveRelationships(rels: ContactRelationship[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.RELATIONSHIPS, JSON.stringify(rels));
    } catch (e) {
      console.error('Failed to save relationships', e);
    }
  },

  getProactiveSuggestions(): ProactiveSuggestion[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.PROACTIVE_SUGGESTIONS);
      return stored ? JSON.parse(stored) : DEFAULT_PROACTIVE_SUGGESTIONS;
    } catch {
      return DEFAULT_PROACTIVE_SUGGESTIONS;
    }
  },

  saveProactiveSuggestions(sugs: ProactiveSuggestion[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.PROACTIVE_SUGGESTIONS, JSON.stringify(sugs));
    } catch (e) {
      console.error('Failed to save proactive suggestions', e);
    }
  },

  getSyncState(): CrossDeviceSyncState {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.SYNC_STATE);
      return stored ? { ...DEFAULT_SYNC_STATE, ...JSON.parse(stored) } : DEFAULT_SYNC_STATE;
    } catch {
      return DEFAULT_SYNC_STATE;
    }
  },

  saveSyncState(state: CrossDeviceSyncState): void {
    try {
      localStorage.setItem(STORAGE_KEYS.SYNC_STATE, JSON.stringify(state));
    } catch (e) {
      console.error('Failed to save sync state', e);
    }
  },

  getDailyAuditLogs(): AuditLogEntry[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.DAILY_AUDIT_LOGS);
      return stored ? JSON.parse(stored) : DEFAULT_DAILY_AUDIT_LOGS;
    } catch {
      return DEFAULT_DAILY_AUDIT_LOGS;
    }
  },

  saveDailyAuditLogs(logs: AuditLogEntry[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.DAILY_AUDIT_LOGS, JSON.stringify(logs));
    } catch (e) {
      console.error('Failed to save audit logs', e);
    }
  },

  logDailyAudit(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): void {
    try {
      const logs = this.getDailyAuditLogs();
      const newEntry: AuditLogEntry = {
        ...entry,
        id: 'aud-log-' + Math.random().toString(36).substring(2, 9),
        timestamp: Date.now()
      };
      logs.unshift(newEntry);
      this.saveDailyAuditLogs(logs.slice(0, 100));
    } catch (e) {
      console.error('Failed to log daily audit', e);
    }
  },

  getUserPreferenceMemory(): { morningBriefingStyle: 'concise' | 'detailed'; eveningBriefingStyle: 'concise' | 'detailed'; toneSensitivity: string } {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.USER_PREFERENCES_MEMORY);
      return stored ? JSON.parse(stored) : {
        morningBriefingStyle: 'concise',
        eveningBriefingStyle: 'detailed',
        toneSensitivity: 'high_adaptive'
      };
    } catch {
      return {
        morningBriefingStyle: 'concise',
        eveningBriefingStyle: 'detailed',
        toneSensitivity: 'high_adaptive'
      };
    }
  },

  saveUserPreferenceMemory(prefs: any): void {
    try {
      localStorage.setItem(STORAGE_KEYS.USER_PREFERENCES_MEMORY, JSON.stringify(prefs));
    } catch (e) {
      console.error('Failed to save user preference memory', e);
    }
  },

  // Completely wipe all local data
  purgeAllLocalData(): void {
    try {
      Object.values(STORAGE_KEYS).forEach(k => localStorage.removeItem(k));
    } catch (e) {
      console.error('Error wiping data', e);
    }
  }
};

