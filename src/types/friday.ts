export type VoiceState = 'standby' | 'listening' | 'processing' | 'speaking' | 'interrupted';

export type FridayPersonality = 'professional' | 'concise' | 'warm' | 'executive';

export interface CompanionPersona {
  id: string;
  name: string;
  role: string;
  color: string;
  icon: string;
  systemPrompt: string;
}

export interface PersonaRoutingItem {
  persona: string;
  action: string;
  status: 'running' | 'done' | 'error';
}

export interface AhriResponse {
  spokenReply: string;
  routing?: PersonaRoutingItem[];
  actionData?: any;
  intent?: string;
  toolsUsed?: string[];
  latencyMs?: number;
}

export interface VoiceSettings {
  wakeWord: string;
  isWakeWordEnabled: boolean;
  voiceName: string;
  rate: number;
  pitch: number;
  volume: number;
  personality: FridayPersonality;
  continuousListening: boolean;
  bargeInEnabled: boolean;
  vadSensitivity: number; // 0.1 to 1.0
  language: string;
  offlineFallback: boolean;
  soundEffects: boolean;
  micDeviceId: string; // '' = system default
}

export interface ActiveTimer {
  id: string;
  label: string;
  totalSeconds: number;
  remainingSeconds: number;
  isRunning: boolean;
  createdAt: number;
}

export interface ReminderItem {
  id: string;
  task: string;
  dueTime: string;
  priority: 'low' | 'medium' | 'high';
  completed: boolean;
  createdAt: number;
  category?: 'work' | 'personal' | 'follow-up';
}

export interface CalendarEvent {
  id: string;
  title: string;
  startTime: string; // e.g. "10:00 AM"
  endTime: string;   // e.g. "11:00 AM"
  date: string;      // "Today", "Tomorrow", or YYYY-MM-DD
  location?: string;
  type: 'meeting' | 'briefing' | 'personal' | 'travel';
  isConflict?: boolean;
  attendees?: string[];
}

export type CommunicationChannel = 'sms' | 'viber' | 'messenger' | 'gmail' | 'phone_call';

export interface ExtractedEntities {
  otpCode?: string;
  address?: string;
  appointmentTime?: string;
  url?: string;
  moneyAmount?: string;
}

export interface MessageItem {
  id: string;
  sender: string;
  senderHandle: string;
  source: CommunicationChannel;
  subject?: string;
  content: string;
  timestamp: string;
  unread: boolean;
  priority: 'urgent' | 'standard' | 'newsletter';
  suggestedReply?: string;
  suggestedReplies?: string[];
  // Smart extracted entities
  extractedEntities?: ExtractedEntities;
  // Group chat support
  isGroupChat?: boolean;
  groupName?: string;
  groupMembers?: string[];
  recentGroupMessages?: { sender: string; text: string; time: string }[];
  // Telephony & Call Logging
  callType?: 'incoming' | 'outgoing' | 'missed' | 'voicemail';
  callDurationSec?: number;
  callSummary?: string;
  voicemailTranscript?: string;
  // Privacy & Breakthrough
  isVip?: boolean;
  isEmergencyBreakthrough?: boolean;
  autoReplied?: boolean;
}

export interface CallSession {
  id: string;
  callerName: string;
  callerHandle: string;
  callerAvatar?: string;
  state: 'ringing' | 'connected' | 'voicemail' | 'ended';
  startedAt: number;
  durationSec: number;
  liveTranscript: string[];
  summary?: string;
  actionItems?: string[];
  autoScreened?: boolean;
}

export interface CommunicationSettings {
  dndMode: 'off' | 'meeting' | 'driving' | 'silent';
  autoResponderEnabled: boolean;
  autoResponderTemplate: string;
  drivingModeHandsFree: boolean;
  emergencyKeywords: string[];
  vipContacts: string[];
  announceIncomingCalls: boolean;
  announceIncomingSMS: boolean;
  viberConnected: boolean;
  messengerConnected: boolean;
  telephonyConnected: boolean;
}

export interface TranscriptSnippet {
  id: string;
  speaker: string;
  speakerId: string;
  timestamp: string;
  timeSeconds: number;
  text: string;
  flagged?: boolean;
  flagReason?: string;
  pitchLevel?: 'low' | 'mid' | 'high';
  confidence?: number;
}

export interface DetailedMinuteSection {
  topic: string;
  timestamp: string;
  keyPoints: string[];
}

export interface MeetingActionItem {
  id: string;
  task: string;
  owner: string;
  deadline: string;
  priority: 'high' | 'medium' | 'low';
  syncedToGoogleTasks?: boolean;
  googleTaskId?: string;
  completed?: boolean;
}

export interface MeetingSpeaker {
  id: string;
  name: string;
  color: string;
  role?: string;
  isLearned?: boolean;
  utteranceCount: number;
}

export type MeetingMode = 'online_google_meet' | 'online_zoom' | 'online_teams' | 'offline_ambient' | 'screen_audio';

export interface MeetingSession {
  id: string;
  title: string;
  date: string;
  startTime: string;
  durationSeconds: number;
  status: 'standby' | 'recording' | 'paused' | 'analyzing' | 'completed';
  mode: MeetingMode;
  meetUrl?: string;
  platform?: 'google_meet' | 'zoom' | 'teams' | 'in_person' | 'browser_tab';
  transcripts: TranscriptSnippet[];
  liveRunningNotes?: string[];
  executiveSummary?: string[];
  detailedMinutes?: DetailedMinuteSection[];
  keyDecisions?: string[];
  actionItems?: MeetingActionItem[];
  speakers: MeetingSpeaker[];
  complianceAnnounced?: boolean;
  autoAnnounceLegalNotice?: boolean;
}

export interface MeetingProviderPlugin {
  id: string;
  name: string;
  icon: string;
  status: 'ready' | 'beta' | 'plugin_stub';
  detectUrlPattern: RegExp;
  joinMethod: 'direct_url' | 'bot_connect' | 'screen_capture';
  description: string;
}

export interface ConversationTurn {
  id: string;
  role: 'user' | 'friday' | 'system';
  text: string;
  timestamp: number;
  latencyMs?: number;
  intent?: string;
  actionData?: Record<string, any>;
}

export interface PrivacyAuditEntry {
  id: string;
  timestamp: number;
  category: 'Voice Audio' | 'Transcript' | 'Calendar Access' | 'Email Access' | 'Timer/Task' | 'Google Workspace' | 'OAuth Token';
  action: string;
  storageType: 'Local IndexedDB' | 'In-Memory Encrypted' | 'Ephemeral';
  sizeBytes: number;
}

// Google Workspace & OAuth Types
export interface WorkspacePermissions {
  calendarRead: boolean;
  calendarWrite: boolean;
  gmailRead: boolean;
  gmailSend: boolean;
  tasks: boolean;
  contacts: boolean;
}

export interface GoogleOAuthState {
  isConnected: boolean;
  accessToken: string | null;
  expiresAt: number | null;
  userEmail: string | null;
  userName: string | null;
  userAvatar?: string | null;
  grantedScopes: string[];
  activePermissions: WorkspacePermissions;
  lastSyncedAt: number | null;
  offlineMode: boolean;
  pendingOfflineActionsCount: number;
}

export interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: { dateTime?: string; date?: string; timeZone?: string };
  end: { dateTime?: string; date?: string; timeZone?: string };
  location?: string;
  attendees?: { email: string; displayName?: string; responseStatus?: string }[];
  hangoutLink?: string;
  htmlLink?: string;
  isConflict?: boolean;
  conflictReason?: string;
}

export interface GoogleGmailMessage {
  id: string;
  threadId: string;
  snippet: string;
  from: string;
  fromName: string;
  fromEmail: string;
  to: string;
  subject: string;
  date: string;
  unread: boolean;
  bodyText?: string;
  summary1Sentence?: string;
  urgencyLevel: 'urgent' | 'high' | 'normal' | 'low';
  urgencyReason?: string;
  suggestedReplyDraft?: string;
}

export interface GoogleTaskItem {
  id: string;
  title: string;
  notes?: string;
  due?: string; // YYYY-MM-DD
  status: 'needsAction' | 'completed';
  listId?: string;
  listTitle?: string;
  updated?: string;
  isOfflineLocal?: boolean;
}

export interface GoogleContact {
  resourceName: string;
  displayName: string;
  emailAddresses: string[];
  phoneNumbers?: string[];
  photoUrl?: string;
}

export interface WorkspaceBriefing {
  id: string;
  generatedAt: number;
  dateFormatted: string;
  calendarSummary: string;
  eventsCount: number;
  firstEventTime?: string;
  firstEventTitle?: string;
  unreadEmailsCount: number;
  urgentEmailsCount: number;
  tasksDueTodayCount: number;
  trafficNote: string;
  weatherNote: string;
  vocalScript: string;
}

export interface RecentContextMemory {
  lastDiscussedEvent?: { id: string; title: string; date: string; time: string };
  lastDiscussedEmail?: { id: string; subject: string; sender: string; senderEmail: string };
  lastDraftedEmail?: { to: string; toName?: string; subject: string; body: string };
  lastDiscussedTask?: { id: string; title: string };
  pendingVoiceConfirmation?: {
    actionType: 'send_email' | 'delete_event' | 'schedule_conflict_override';
    data: any;
    prompt: string;
  } | null;
}

// ==========================================
// PHASE 6: SECRETARY BRAIN & PRODUCTION TYPES
// ==========================================

export type HabitType = 'calendar' | 'communication' | 'focus_time' | 'health' | 'executive';

export interface HabitPattern {
  id: string;
  title: string;
  type: HabitType;
  confidenceScore: number; // 0 to 100%
  description: string;
  triggerCondition: string;
  suggestedAction: string;
  occurrenceCount: number;
  acceptedCount: number;
  dismissedCount: number;
  status: 'active' | 'learning' | 'disabled';
  lastObservedAt: number;
  voicePrompt: string;
}

export interface ContactRelationship {
  id: string;
  contactName: string;
  email: string;
  phone?: string;
  organization?: string;
  importanceScore: number; // 1 to 100
  lastInteractedAt: number;
  recommendedCadenceDays: number;
  relationshipStatus: 'healthy' | 'needs_attention' | 'dormant';
  lastChannel: CommunicationChannel;
  notes?: string;
  suggestedNudge?: string;
}

export interface PredictiveMeetingPrep {
  meetingId: string;
  meetingTitle: string;
  startTime: string;
  attendees: string[];
  relevantEmails: { subject: string; from: string; snippet: string; date: string }[];
  priorMeetingMinutes?: { topic: string; decisions: string[]; actionItems: string[] };
  suggestedAgendaItems: string[];
  requiredDocuments: { title: string; type: string; url?: string }[];
  spokenSummary: string;
}

export interface MorningBriefingV2 {
  id: string;
  generatedAt: number;
  meetingsCount: number;
  trafficStatus: {
    firstMeetingTime: string;
    routeStatus: 'light' | 'moderate' | 'heavy';
    departureWarning: string;
    commuteMinutes: number;
  };
  urgentInbox: {
    urgentCount: number;
    vipSenders: string[];
    topSubject: string;
  };
  habitAndHealthCheck: {
    workoutDaysGap: number;
    workoutSlotRecommended: string;
    focusBlocksReserved: number;
  };
  vocalScript: string;
}

export type DataResidencyRegion = 'us-east' | 'eu-central' | 'asia-east';

export interface SyncedDevice {
  deviceId: string;
  deviceName: string;
  deviceType: 'desktop_mac' | 'desktop_win' | 'mobile_ios' | 'mobile_android' | 'web';
  isOnline: boolean;
  lastSyncedAt: number;
  appVersion: string;
  ipLocation: string;
  isCurrentDevice?: boolean;
}

export interface CrossDeviceSyncState {
  isOnline: boolean;
  syncStatus: 'synced' | 'syncing' | 'conflict_resolved' | 'offline';
  lastSyncedTimestamp: number;
  connectedDevices: SyncedDevice[];
  e2eeKeyFingerprint: string;
  pendingSyncCount: number;
  dataResidency: DataResidencyRegion;
  conflictResolutionMode: 'auto_merge' | 'server_authoritative' | 'client_first';
}

export type EmotionState = 'calm' | 'focused' | 'stressed' | 'fatigued' | 'urgent';

export interface VoiceEmotionProfile {
  detectedEmotion: EmotionState;
  confidence: number;
  stressScore: number; // 0 to 100
  adaptedToneRecommendation: string;
  acousticJitterScore: number;
  suggestedIntervention?: string;
}

export interface VoicePersonaOption {
  id: string;
  name: string;
  description: string;
  accent: string;
  style: 'crisp' | 'warm' | 'tactical' | 'mentor';
  rate: number;
  pitch: number;
  personality: FridayPersonality;
  isCustomCloned?: boolean;
}

export interface AuditLogEntry {
  id: string;
  timestamp: number;
  actionType: 'email_sent' | 'event_created' | 'message_read' | 'biometric_auth' | 'e2ee_sync' | 'habit_applied' | 'call_screened';
  description: string;
  riskLevel: 'low' | 'medium' | 'high';
  biometricVerified: boolean;
  deviceOrigin: string;
}

export interface ProactiveSuggestion {
  id: string;
  type: 'morning_briefing' | 'habit_block' | 'predictive_prep' | 'relationship_nudge' | 'break_reminder' | 'traffic_alert';
  title: string;
  description: string;
  spokenPrompt: string;
  actionType: string;
  actionPayload?: Record<string, any>;
  accepted?: boolean;
  dismissed?: boolean;
  feedbackRating?: 'helpful' | 'unhelpful';
  timestamp: number;
  badge: string;
}

export interface SystemTelemetryMetrics {
  launchTimeMs: number;
  voiceLatencyMs: number;
  backgroundBatteryPerHour: number;
  crashFreeRatePercent: number;
  totalRequestsHandled: number;
  e2eeOperationsCount: number;
  syncLatencyMs: number;
  activeWebSocketSessions: number;
}

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'active' | 'completed';
  voiceInstruction: string;
  commandToTry: string;
}

