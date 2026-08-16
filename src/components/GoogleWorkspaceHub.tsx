import React, { useState, useEffect } from 'react';
import { 
  Calendar as CalendarIcon, 
  Mail, 
  CheckSquare, 
  Users, 
  Shield, 
  Sparkles, 
  Plus, 
  RefreshCw, 
  Clock, 
  Video, 
  Send, 
  AlertTriangle, 
  Search, 
  Mic, 
  Volume2, 
  CheckCircle2, 
  WifiOff, 
  ExternalLink,
  ChevronRight,
  Sun,
  Car
} from 'lucide-react';
import { googleWorkspaceService } from '../services/googleWorkspace';
import { 
  GoogleOAuthState, 
  GoogleCalendarEvent, 
  GoogleGmailMessage, 
  GoogleTaskItem, 
  GoogleContact, 
  WorkspaceBriefing 
} from '../types/friday';
import { soundEffects } from '../services/audioEffects';

interface GoogleWorkspaceHubProps {
  onSpeak: (text: string) => void;
  onVoiceCommandTrigger?: (command: string) => void;
}

export const GoogleWorkspaceHub: React.FC<GoogleWorkspaceHubProps> = ({
  onSpeak,
  onVoiceCommandTrigger
}) => {
  const [oauthState, setOauthState] = useState<GoogleOAuthState>(googleWorkspaceService.getOAuthState());
  const [activeTab, setActiveTab] = useState<'briefing' | 'calendar' | 'gmail' | 'tasks' | 'contacts' | 'permissions'>('briefing');
  
  const [briefing, setBriefing] = useState<WorkspaceBriefing>(googleWorkspaceService.generateDailyBriefing());
  const [calendarEvents, setCalendarEvents] = useState<GoogleCalendarEvent[]>(googleWorkspaceService.getCachedCalendarEvents());
  const [emails, setEmails] = useState<GoogleGmailMessage[]>(googleWorkspaceService.getCachedEmails());
  const [tasks, setTasks] = useState<GoogleTaskItem[]>(googleWorkspaceService.getCachedTasks());
  const [contacts, setContacts] = useState<GoogleContact[]>(googleWorkspaceService.getCachedContacts());

  // Scheduler state
  const [isScheduling, setIsScheduling] = useState(false);
  const [scheduleTitle, setScheduleTitle] = useState('');
  const [scheduleAttendee, setScheduleAttendee] = useState('John Vance');
  const [scheduleTime, setScheduleTime] = useState('02:00 PM');
  const [scheduleDate, setScheduleDate] = useState('Tomorrow');
  const [scheduleDuration, setScheduleDuration] = useState('30');
  const [scheduleProposal, setScheduleProposal] = useState<string | null>(null);

  // Email Drafter state
  const [isDrafting, setIsDrafting] = useState(false);
  const [draftRecipient, setDraftRecipient] = useState('');
  const [draftSubject, setDraftSubject] = useState('');
  const [draftBody, setDraftBody] = useState('');
  const [draftSentSuccess, setDraftSentSuccess] = useState(false);
  const [emailSearchQuery, setEmailSearchQuery] = useState('');

  // Task Creator state
  const [newTaskTitle, setNewTaskTitle] = useState('');

  // Sync / Loading state
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  // Reload state from service
  const reloadData = () => {
    setOauthState(googleWorkspaceService.getOAuthState());
    setCalendarEvents(googleWorkspaceService.getCachedCalendarEvents());
    setEmails(googleWorkspaceService.getCachedEmails());
    setTasks(googleWorkspaceService.getCachedTasks());
    setContacts(googleWorkspaceService.getCachedContacts());
    setBriefing(googleWorkspaceService.generateDailyBriefing());
  };

  useEffect(() => {
    reloadData();
  }, []);

  const handleSyncAll = async () => {
    setIsSyncing(true);
    soundEffects.playAcknowledge();
    try {
      if (!oauthState.isConnected) {
        await googleWorkspaceService.connectGoogleOAuth();
      }
      const [evts, msgs, tsks] = await Promise.all([
        googleWorkspaceService.fetchCalendarEvents().catch(() => calendarEvents),
        googleWorkspaceService.fetchUnreadEmails().catch(() => emails),
        googleWorkspaceService.fetchTasks().catch(() => tasks)
      ]);
      setCalendarEvents(evts);
      setEmails(msgs);
      setTasks(tsks);
      setOauthState(googleWorkspaceService.getOAuthState());
      setSyncFeedback('Google Workspace synchronized.');
      setTimeout(() => setSyncFeedback(null), 4000);
    } catch (e) {
      console.warn('Sync fallback', e);
      setSyncFeedback('Local cache updated.');
      setTimeout(() => setSyncFeedback(null), 3000);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleTogglePermission = (key: keyof typeof oauthState.activePermissions) => {
    const updated = googleWorkspaceService.updatePermissions({
      [key]: !oauthState.activePermissions[key]
    });
    setOauthState(updated);
  };

  const handleConnectOAuth = async () => {
    soundEffects.playAcknowledge();
    const newState = await googleWorkspaceService.connectGoogleOAuth();
    setOauthState(newState);
    handleSyncAll();
  };

  const handleDisconnectOAuth = () => {
    soundEffects.playAcknowledge();
    const newState = googleWorkspaceService.disconnectGoogleOAuth();
    setOauthState(newState);
  };

  // Calendar Scheduling Handler
  const handleScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduleTitle.trim()) return;

    soundEffects.playAcknowledge();
    const targetDate = new Date();
    if (scheduleDate === 'Tomorrow') {
      targetDate.setDate(targetDate.getDate() + 1);
    }
    
    const hourMatch = scheduleTime.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
    let hours = 14;
    let mins = 0;
    if (hourMatch) {
      hours = parseInt(hourMatch[1], 10);
      if (hourMatch[2]) mins = parseInt(hourMatch[2], 10);
      const ampm = (hourMatch[3] || '').toLowerCase();
      if (ampm === 'pm' && hours < 12) hours += 12;
      if (ampm === 'am' && hours === 12) hours = 0;
    }
    targetDate.setHours(hours, mins, 0, 0);

    const result = await googleWorkspaceService.createCalendarEvent({
      summary: scheduleTitle,
      startDateTime: targetDate.toISOString(),
      durationMinutes: parseInt(scheduleDuration, 10) || 30,
      attendeeNamesOrEmails: [scheduleAttendee],
      location: 'Google Meet'
    });

    if (result.success) {
      setScheduleProposal(null);
      setIsScheduling(false);
      setScheduleTitle('');
      reloadData();
      onSpeak(`Scheduled "${scheduleTitle}" for ${scheduleDate} at ${scheduleTime} on your Google Calendar.`);
    } else if (result.proposal) {
      setScheduleProposal(result.proposal);
      onSpeak(result.proposal);
    }
  };

  // Gmail Send Handler
  const handleSendDraft = async () => {
    soundEffects.playAcknowledge();
    const contact = googleWorkspaceService.searchContactByName(draftRecipient);
    const targetEmail = contact?.emailAddresses[0] || (draftRecipient.includes('@') ? draftRecipient : `${draftRecipient.toLowerCase().replace(/\s+/g, '')}@enterprise.com`);
    
    await googleWorkspaceService.sendEmail(targetEmail, draftSubject, draftBody);
    setDraftSentSuccess(true);
    onSpeak(`Email dispatched to ${draftRecipient} via Gmail.`);
    
    setTimeout(() => {
      setDraftSentSuccess(false);
      setIsDrafting(false);
      reloadData();
    }, 2000);
  };

  // Task Creator Handler
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    soundEffects.playAcknowledge();
    await googleWorkspaceService.createTask(newTaskTitle.trim());
    setNewTaskTitle('');
    reloadData();
    onSpeak(`Added "${newTaskTitle}" to Google Tasks.`);
  };

  const handleToggleTask = async (taskId: string, currentStatus: string) => {
    soundEffects.playAcknowledge();
    const newStatus = currentStatus === 'completed' ? false : true;
    await googleWorkspaceService.toggleTaskStatus(taskId, newStatus);
    reloadData();
  };

  const handleDeleteTask = async (taskId: string) => {
    soundEffects.playAcknowledge();
    await googleWorkspaceService.deleteTask(taskId);
    reloadData();
  };

  const filteredEmails = emailSearchQuery.trim()
    ? googleWorkspaceService.searchEmails(emailSearchQuery)
    : emails;

  return (
    <div className="bg-zinc-950/80 border border-zinc-800/90 rounded-2xl p-6 backdrop-blur-md space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-gradient-to-br from-sky-500/20 to-blue-950 border border-sky-500/30 rounded-xl shadow-[0_0_15px_rgba(56,189,248,0.2)]">
            <Sparkles className="w-5 h-5 text-sky-400" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-base font-bold text-zinc-100 uppercase tracking-wider font-mono">
                Google Workspace Intelligence
              </h2>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border ${
                oauthState.isConnected 
                  ? 'bg-emerald-950/70 border-emerald-500/50 text-emerald-300' 
                  : 'bg-amber-950/70 border-amber-500/50 text-amber-300'
              }`}>
                {oauthState.isConnected ? 'OAuth Active' : 'Offline / Standby'}
              </span>
            </div>
            <p className="text-xs text-zinc-400 font-mono">
              Live Google Calendar • Gmail Triage • Tasks Sync • Contacts Directory
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {oauthState.isConnected ? (
            <div className="flex items-center space-x-2">
              <span className="text-xs text-zinc-400 font-mono hidden md:inline">
                {oauthState.userEmail}
              </span>
              <button
                onClick={handleSyncAll}
                disabled={isSyncing}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs text-zinc-200 rounded-xl transition-all font-mono cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-sky-400 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Syncing...' : 'Sync'}</span>
              </button>
              <button
                onClick={handleDisconnectOAuth}
                className="px-3 py-1.5 bg-zinc-900 hover:bg-red-950/40 border border-zinc-800 hover:border-red-500/50 text-xs text-zinc-400 hover:text-red-300 rounded-xl transition-colors font-mono cursor-pointer"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <button
              onClick={handleConnectOAuth}
              className="flex items-center space-x-2 px-4 py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold rounded-xl shadow-[0_0_15px_rgba(14,165,233,0.3)] transition-all font-mono cursor-pointer"
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Connect Google Account</span>
            </button>
          )}
        </div>
      </div>

      {syncFeedback && (
        <div className="p-2.5 rounded-xl bg-sky-950/60 border border-sky-500/40 text-xs text-sky-200 font-mono flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-sky-400" />
            <span>{syncFeedback}</span>
          </div>
          <span className="text-[10px] text-zinc-400">Zero data leaks • Local-first cache</span>
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="flex flex-wrap items-center gap-2 border-b border-zinc-800 pb-3">
        {[
          { id: 'briefing', label: 'Executive Briefing', icon: Sparkles, count: undefined },
          { id: 'calendar', label: 'Google Calendar', icon: CalendarIcon, count: calendarEvents.length },
          { id: 'gmail', label: 'Gmail Triage', icon: Mail, count: emails.filter(e => e.unread).length },
          { id: 'tasks', label: 'Google Tasks', icon: CheckSquare, count: tasks.filter(t => t.status === 'needsAction').length },
          { id: 'contacts', label: 'Contacts', icon: Users, count: contacts.length },
          { id: 'permissions', label: 'Security & Scopes', icon: Shield, count: undefined }
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl text-xs font-mono transition-all cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-sky-950/80 text-sky-300 border border-sky-500/40 font-semibold shadow-sm'
                  : 'bg-zinc-900/60 hover:bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span className={`px-1.5 py-0.2 text-[10px] rounded-full ${
                  activeTab === tab.id ? 'bg-sky-800 text-sky-100' : 'bg-zinc-800 text-zinc-400'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ========================================== */}
      {/* TAB 1: EXECUTIVE BRIEFING                  */}
      {/* ========================================== */}
      {activeTab === 'briefing' && (
        <div className="space-y-4">
          <div className="p-5 rounded-2xl bg-gradient-to-br from-zinc-900/90 via-zinc-900/60 to-zinc-950 border border-sky-500/30 shadow-[0_0_20px_rgba(56,189,248,0.1)]">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
              <div>
                <span className="text-[11px] text-sky-400 font-mono uppercase tracking-wider font-semibold">
                  Autonomous Daily Intelligence Briefing
                </span>
                <h3 className="text-lg font-bold text-zinc-100">{briefing.dateFormatted}</h3>
              </div>
              <button
                onClick={() => onSpeak(briefing.vocalScript)}
                className="flex items-center space-x-2 px-3.5 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold rounded-xl shadow-md transition-all font-mono cursor-pointer"
              >
                <Volume2 className="w-4 h-4" />
                <span>Play FRIDAY Vocal Briefing</span>
              </button>
            </div>

            <p className="text-sm text-zinc-200 leading-relaxed font-sans mb-4 p-3 bg-zinc-950/60 rounded-xl border border-zinc-800/80">
              "{briefing.vocalScript}"
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-xl bg-zinc-950/80 border border-zinc-800/80">
                <div className="flex items-center space-x-2 text-sky-400 text-xs font-mono font-medium mb-1">
                  <CalendarIcon className="w-4 h-4" />
                  <span>Calendar Overview</span>
                </div>
                <p className="text-xs text-zinc-300">
                  {briefing.eventsCount} meetings today. Next: <span className="font-semibold text-zinc-100">{briefing.firstEventTitle}</span> at {briefing.firstEventTime}.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-zinc-950/80 border border-zinc-800/80">
                <div className="flex items-center space-x-2 text-purple-400 text-xs font-mono font-medium mb-1">
                  <Mail className="w-4 h-4" />
                  <span>Email Urgency</span>
                </div>
                <p className="text-xs text-zinc-300">
                  {briefing.unreadEmailsCount} unread emails. <span className="font-semibold text-amber-300">{briefing.urgentEmailsCount} urgent</span> requiring sign-off.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-zinc-950/80 border border-zinc-800/80">
                <div className="flex items-center space-x-2 text-emerald-400 text-xs font-mono font-medium mb-1">
                  <Car className="w-4 h-4" />
                  <span>Transit & Weather</span>
                </div>
                <p className="text-xs text-zinc-300">
                  {briefing.weatherNote}. {briefing.trafficNote}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* TAB 2: GOOGLE CALENDAR & SCHEDULER         */}
      {/* ========================================== */}
      {activeTab === 'calendar' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <h3 className="text-sm font-semibold text-zinc-200 uppercase font-mono">
                Google Calendar Events
              </h3>
              <span className="text-xs text-zinc-500 font-mono">
                ({calendarEvents.length} items)
              </span>
            </div>
            <button
              onClick={() => setIsScheduling(true)}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium rounded-xl transition-all cursor-pointer font-mono"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Schedule Meeting</span>
            </button>
          </div>

          {/* Conflict Proactive Bar */}
          <div className="p-3 rounded-xl bg-sky-950/30 border border-sky-800/40 flex items-start justify-between">
            <div className="flex items-start space-x-2.5">
              <Sparkles className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
              <p className="text-xs text-zinc-300">
                <span className="font-semibold text-sky-300">Smart Slot Finder: </span>
                Need a 45-minute sync this week? Recommended slots: <span className="font-mono text-zinc-100 font-semibold">Tomorrow at 10:00 AM</span> or <span className="font-mono text-zinc-100 font-semibold">Tomorrow at 3:15 PM</span>.
              </p>
            </div>
            <button
              onClick={() => {
                setScheduleTitle('Architecture Team Sync');
                setScheduleTime('10:00 AM');
                setScheduleDate('Tomorrow');
                setScheduleDuration('45');
                setIsScheduling(true);
              }}
              className="text-[11px] text-sky-400 hover:underline font-mono ml-3 shrink-0"
            >
              Book Slot
            </button>
          </div>

          {/* Calendar List */}
          <div className="space-y-2.5">
            {calendarEvents.map((evt) => (
              <div
                key={evt.id}
                className="p-3.5 rounded-xl bg-zinc-900/50 border border-zinc-800/80 hover:border-zinc-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition-colors"
              >
                <div className="flex items-start space-x-3">
                  <div className="p-2.5 bg-zinc-950 rounded-xl border border-zinc-800 text-center font-mono w-16 shrink-0">
                    <span className="text-xs font-bold text-sky-400 block">
                      {evt.start.dateTime ? new Date(evt.start.dateTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'All Day'}
                    </span>
                    <span className="text-[10px] text-zinc-500">
                      {evt.start.dateTime ? new Date(evt.start.dateTime).toLocaleDateString([], { weekday: 'short' }) : 'Today'}
                    </span>
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold text-zinc-100 flex items-center space-x-2">
                      <span>{evt.summary}</span>
                      {evt.isConflict && (
                        <span className="px-1.5 py-0.2 bg-amber-950 text-amber-400 border border-amber-800 text-[10px] rounded font-mono">
                          Conflict
                        </span>
                      )}
                    </h4>
                    <p className="text-xs text-zinc-400 line-clamp-1 mt-0.5">{evt.description}</p>
                    
                    <div className="flex flex-wrap items-center gap-3 mt-1.5 text-[11px] text-zinc-400 font-mono">
                      {evt.location && (
                        <span className="flex items-center space-x-1 text-zinc-400">
                          <Clock className="w-3 h-3 text-zinc-500" />
                          <span>{evt.location}</span>
                        </span>
                      )}
                      {evt.attendees && evt.attendees.length > 0 && (
                        <span className="flex items-center space-x-1 text-zinc-400">
                          <Users className="w-3 h-3 text-zinc-500" />
                          <span>{evt.attendees.map(a => a.displayName || a.email.split('@')[0]).join(', ')}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2 shrink-0 self-end sm:self-center">
                  {evt.hangoutLink && (
                    <a
                      href={evt.hangoutLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center space-x-1 px-3 py-1.5 bg-emerald-950/70 hover:bg-emerald-900/70 border border-emerald-600/40 text-emerald-300 text-xs rounded-xl font-mono transition-colors"
                    >
                      <Video className="w-3.5 h-3.5" />
                      <span>Join Meet</span>
                    </a>
                  )}
                  <button
                    onClick={() => {
                      googleWorkspaceService.deleteCalendarEvent(evt.id);
                      reloadData();
                      onSpeak(`Deleted "${evt.summary}" from Google Calendar.`);
                    }}
                    className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-950/30 rounded-lg text-xs"
                    title="Delete"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Schedule Modal */}
          {isScheduling && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
              <div className="bg-zinc-950 border border-zinc-800 p-6 rounded-2xl max-w-md w-full shadow-2xl space-y-4">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                  <h4 className="text-sm font-bold text-zinc-100 font-mono">
                    Schedule with Google Calendar
                  </h4>
                  <button
                    onClick={() => { setIsScheduling(false); setScheduleProposal(null); }}
                    className="text-xs text-zinc-400 hover:text-zinc-200"
                  >
                    ✕
                  </button>
                </div>

                {scheduleProposal && (
                  <div className="p-3 rounded-xl bg-amber-950/60 border border-amber-500/40 text-xs text-amber-200">
                    <p className="font-semibold flex items-center gap-1.5 mb-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                      Conflict Detected:
                    </p>
                    <p>{scheduleProposal}</p>
                  </div>
                )}

                <form onSubmit={handleScheduleSubmit} className="space-y-3">
                  <div>
                    <label className="text-xs text-zinc-400 block mb-1 font-mono">Meeting Title</label>
                    <input
                      type="text"
                      required
                      value={scheduleTitle}
                      onChange={(e) => setScheduleTitle(e.target.value)}
                      placeholder="e.g. Executive Sync on Neural Voice"
                      className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-200 focus:outline-none focus:border-sky-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-zinc-400 block mb-1 font-mono">Date</label>
                      <select
                        value={scheduleDate}
                        onChange={(e) => setScheduleDate(e.target.value)}
                        className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-200 focus:outline-none"
                      >
                        <option value="Today">Today</option>
                        <option value="Tomorrow">Tomorrow</option>
                        <option value="Thursday">Thursday</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs text-zinc-400 block mb-1 font-mono">Time</label>
                      <input
                        type="text"
                        value={scheduleTime}
                        onChange={(e) => setScheduleTime(e.target.value)}
                        className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-200 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-zinc-400 block mb-1 font-mono">Attendee / Contact</label>
                      <input
                        type="text"
                        value={scheduleAttendee}
                        onChange={(e) => setScheduleAttendee(e.target.value)}
                        className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-200 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-zinc-400 block mb-1 font-mono">Duration (Minutes)</label>
                      <select
                        value={scheduleDuration}
                        onChange={(e) => setScheduleDuration(e.target.value)}
                        className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-200 focus:outline-none"
                      >
                        <option value="15">15 minutes</option>
                        <option value="30">30 minutes</option>
                        <option value="45">45 minutes</option>
                        <option value="60">60 minutes</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-end space-x-2 pt-3 border-t border-zinc-800">
                    <button
                      type="button"
                      onClick={() => { setIsScheduling(false); setScheduleProposal(null); }}
                      className="px-3.5 py-1.5 bg-zinc-900 text-zinc-400 hover:text-zinc-200 text-xs rounded-xl font-mono"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold rounded-xl font-mono"
                    >
                      Confirm Schedule
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================== */}
      {/* TAB 3: GMAIL TRIAGE & DRAFTER              */}
      {/* ========================================== */}
      {activeTab === 'gmail' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-2">
              <h3 className="text-sm font-semibold text-zinc-200 uppercase font-mono">
                Gmail Executive Triage
              </h3>
              <span className="px-2 py-0.5 bg-purple-950/70 border border-purple-800/50 text-purple-300 text-xs rounded-full font-mono">
                {emails.filter(e => e.unread).length} Unread
              </span>
            </div>

            <div className="flex items-center space-x-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={emailSearchQuery}
                  onChange={(e) => setEmailSearchQuery(e.target.value)}
                  placeholder="Search emails (e.g. budget, urgent)..."
                  className="w-full pl-8 pr-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-200 focus:outline-none focus:border-sky-500 font-mono"
                />
              </div>
              <button
                onClick={() => setIsDrafting(true)}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-xl transition-all font-mono cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Draft</span>
              </button>
            </div>
          </div>

          {/* Email List with 1-Sentence Summaries */}
          <div className="space-y-3">
            {filteredEmails.map((msg) => (
              <div
                key={msg.id}
                className={`p-4 rounded-xl border transition-all ${
                  msg.urgencyLevel === 'urgent'
                    ? 'bg-gradient-to-r from-red-950/30 via-zinc-900/60 to-zinc-900/60 border-red-800/50'
                    : msg.unread
                    ? 'bg-zinc-900/70 border-purple-900/40'
                    : 'bg-zinc-900/30 border-zinc-800/60 opacity-80'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="flex items-center space-x-2">
                    <span className={`w-2 h-2 rounded-full ${msg.unread ? 'bg-purple-400' : 'bg-transparent'}`} />
                    <span className="text-xs font-bold text-zinc-100">{msg.fromName}</span>
                    <span className="text-[10px] text-zinc-500 font-mono">&lt;{msg.fromEmail}&gt;</span>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {msg.urgencyLevel === 'urgent' && (
                      <span className="px-2 py-0.5 bg-red-950 border border-red-700 text-red-300 text-[10px] rounded font-mono font-bold">
                        URGENT DEADLINE
                      </span>
                    )}
                    <span className="text-[10px] text-zinc-500 font-mono">{msg.date}</span>
                  </div>
                </div>

                <h4 className="text-xs font-semibold text-zinc-200 mb-1">{msg.subject}</h4>
                
                {/* 1-Sentence AI Summary */}
                <div className="p-2.5 rounded-lg bg-zinc-950/60 border border-zinc-800/80 mb-2.5 text-xs text-sky-200 font-sans flex items-start space-x-2">
                  <Sparkles className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-zinc-400 font-mono text-[10px] uppercase block font-semibold">
                      FRIDAY 1-Sentence Summary:
                    </span>
                    <span>{msg.summary1Sentence || msg.snippet}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between text-xs pt-1 border-t border-zinc-800/60">
                  <button
                    onClick={() => onSpeak(`Message from ${msg.fromName}: ${msg.summary1Sentence || msg.snippet}`)}
                    className="text-sky-400 hover:text-sky-300 flex items-center space-x-1.5 font-mono"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>Read Aloud</span>
                  </button>

                  <button
                    onClick={() => {
                      setDraftRecipient(msg.fromName);
                      setDraftSubject(`Re: ${msg.subject}`);
                      setDraftBody(msg.suggestedReplyDraft || 'Thank you for the update. Approved.');
                      setIsDrafting(true);
                    }}
                    className="text-purple-400 hover:text-purple-300 flex items-center space-x-1 font-mono font-medium"
                  >
                    <span>Draft Reply</span>
                    <Send className="w-3 h-3 ml-1" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Email Composer Modal */}
          {isDrafting && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
              <div className="bg-zinc-950 border border-zinc-800 p-6 rounded-2xl max-w-lg w-full shadow-2xl space-y-4">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                  <h4 className="text-sm font-bold text-zinc-100 font-mono flex items-center space-x-2">
                    <Mail className="w-4 h-4 text-purple-400" />
                    <span>Authorize & Send via Gmail</span>
                  </h4>
                  <button
                    onClick={() => setIsDrafting(false)}
                    className="text-xs text-zinc-400 hover:text-zinc-200"
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-zinc-400 block mb-1 font-mono">Recipient</label>
                    <input
                      type="text"
                      value={draftRecipient}
                      onChange={(e) => setDraftRecipient(e.target.value)}
                      className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-200 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-zinc-400 block mb-1 font-mono">Subject Line</label>
                    <input
                      type="text"
                      value={draftSubject}
                      onChange={(e) => setDraftSubject(e.target.value)}
                      className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-200 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-zinc-400 block mb-1 font-mono">Email Body</label>
                    <textarea
                      rows={5}
                      value={draftBody}
                      onChange={(e) => setDraftBody(e.target.value)}
                      className="w-full p-3 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-200 focus:outline-none resize-none font-sans"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-zinc-800">
                    <span className="text-[11px] text-zinc-500 font-mono">
                      Voice command: "Send it" triggers dispatch
                    </span>

                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setIsDrafting(false)}
                        className="px-3 py-1.5 bg-zinc-900 text-zinc-400 hover:text-zinc-200 text-xs rounded-xl font-mono"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSendDraft}
                        disabled={draftSentSuccess}
                        className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-xl flex items-center space-x-1.5 font-mono shadow-md"
                      >
                        {draftSentSuccess ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                            <span>Sent!</span>
                          </>
                        ) : (
                          <>
                            <Send className="w-3.5 h-3.5" />
                            <span>Authorize & Send</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================== */}
      {/* TAB 4: GOOGLE TASKS                        */}
      {/* ========================================== */}
      {activeTab === 'tasks' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-200 uppercase font-mono">
              Google Tasks Action List
            </h3>
            <span className="text-xs text-zinc-500 font-mono">
              {tasks.filter(t => t.status === 'needsAction').length} Pending Tasks
            </span>
          </div>

          {/* Fast Task Adder */}
          <form onSubmit={handleCreateTask} className="flex items-center space-x-2">
            <input
              type="text"
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              placeholder="Add new task (e.g. 'Review security audit report')..."
              className="flex-1 px-3.5 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-200 focus:outline-none focus:border-sky-500 font-mono"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold rounded-xl transition-all font-mono shrink-0 cursor-pointer"
            >
              Add Task
            </button>
          </form>

          <div className="space-y-2">
            {tasks.map((task) => (
              <div
                key={task.id}
                className={`p-3.5 rounded-xl border flex items-center justify-between transition-all ${
                  task.status === 'completed'
                    ? 'bg-zinc-900/30 border-zinc-800/40 opacity-60'
                    : 'bg-zinc-900/60 border-zinc-800/90 hover:border-zinc-700'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={task.status === 'completed'}
                    onChange={() => handleToggleTask(task.id, task.status)}
                    className="w-4 h-4 rounded bg-zinc-950 border-zinc-700 text-sky-500 focus:ring-0 cursor-pointer"
                  />
                  <div>
                    <p className={`text-xs font-medium ${
                      task.status === 'completed' ? 'line-through text-zinc-500' : 'text-zinc-100'
                    }`}>
                      {task.title}
                    </p>
                    {task.notes && (
                      <p className="text-[11px] text-zinc-400 mt-0.5">{task.notes}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  {task.due && (
                    <span className="text-[10px] text-zinc-500 font-mono">
                      Due: {task.due}
                    </span>
                  )}
                  <button
                    onClick={() => handleDeleteTask(task.id)}
                    className="text-zinc-600 hover:text-red-400 p-1 text-xs"
                    title="Delete"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* TAB 5: GOOGLE CONTACTS                     */}
      {/* ========================================== */}
      {activeTab === 'contacts' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-200 uppercase font-mono">
              Google Contacts Directory
            </h3>
            <span className="text-xs text-zinc-500 font-mono">
              {contacts.length} VIP Contacts Cached
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {contacts.map((c) => (
              <div
                key={c.resourceName}
                className="p-3.5 rounded-xl bg-zinc-900/50 border border-zinc-800 flex items-center justify-between"
              >
                <div>
                  <h4 className="text-xs font-bold text-zinc-100">{c.displayName}</h4>
                  <p className="text-[11px] text-sky-400 font-mono">{c.emailAddresses.join(', ')}</p>
                  {c.phoneNumbers && (
                    <p className="text-[10px] text-zinc-500 font-mono">{c.phoneNumbers.join(', ')}</p>
                  )}
                </div>

                <button
                  onClick={() => {
                    setDraftRecipient(c.displayName);
                    setDraftSubject('Executive Sync');
                    setDraftBody(`Hi ${c.displayName},\n\nHope all is well. Reaching out regarding our upcoming milestone.\n\nBest regards,`);
                    setIsDrafting(true);
                    setActiveTab('gmail');
                  }}
                  className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-200 rounded-lg font-mono"
                >
                  Email
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* TAB 6: SECURITY & SCOPES                   */}
      {/* ========================================== */}
      {activeTab === 'permissions' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800">
            <h4 className="text-xs font-bold text-zinc-100 uppercase font-mono mb-2">
              Granular Google Workspace Scopes
            </h4>
            <p className="text-xs text-zinc-400 mb-4 leading-relaxed">
              FRIDAY enforces strict on-device data isolation. You can toggle or revoke access to individual Google Workspace APIs at any time.
            </p>

            <div className="space-y-3">
              {[
                { key: 'calendarRead', title: 'Google Calendar Read', desc: 'Allows FRIDAY to detect schedule conflicts and prepare daily briefings.' },
                { key: 'calendarWrite', title: 'Google Calendar Write', desc: 'Allows FRIDAY to book meetings and generate Google Meet invites upon command.' },
                { key: 'gmailRead', title: 'Gmail Read & Triage', desc: 'Allows FRIDAY to summarize unread emails and flag high-priority deadlines.' },
                { key: 'gmailSend', title: 'Gmail Dispatch', desc: 'Allows FRIDAY to draft and send outbound emails after executive authorization.' },
                { key: 'tasks', title: 'Google Tasks Sync', desc: 'Allows FRIDAY to manage to-do items with offline synchronization.' },
                { key: 'contacts', title: 'Google Contacts Lookup', desc: 'Allows FRIDAY to lookup attendee email addresses for fast scheduling.' }
              ].map(({ key, title, desc }) => {
                const isEnabled = (oauthState.activePermissions as any)[key];
                return (
                  <div
                    key={key}
                    className="flex items-center justify-between p-3 rounded-xl bg-zinc-950 border border-zinc-800/80"
                  >
                    <div>
                      <h5 className="text-xs font-semibold text-zinc-200">{title}</h5>
                      <p className="text-[11px] text-zinc-400">{desc}</p>
                    </div>

                    <button
                      onClick={() => handleTogglePermission(key as any)}
                      className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                        isEnabled ? 'bg-sky-600' : 'bg-zinc-800'
                      }`}
                    >
                      <span className={`block w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                        isEnabled ? 'left-6' : 'left-1'
                      }`} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
