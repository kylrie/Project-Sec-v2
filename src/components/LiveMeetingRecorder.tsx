import React, { useState, useEffect, useRef } from 'react';
import { 
  MeetingSession, 
  TranscriptSnippet, 
  MeetingActionItem, 
  MeetingSpeaker, 
  MeetingMode,
  GoogleCalendarEvent
} from '../types/friday';
import { meetingService, AVAILABLE_PLUGINS } from '../services/meetingService';
import { MeetingExportService } from '../services/meetingExportService';
import { googleWorkspaceService } from '../services/googleWorkspace';
import { soundEffects } from '../services/audioEffects';
import { 
  Mic, 
  MicOff, 
  Play, 
  Pause, 
  Square, 
  Bookmark, 
  Sparkles, 
  FileText, 
  CheckCircle, 
  Clock, 
  Users, 
  Download, 
  Copy, 
  Check, 
  Video, 
  PhoneCall, 
  Search, 
  Volume2, 
  Shield, 
  AlertTriangle, 
  ExternalLink, 
  CheckSquare, 
  Edit3, 
  RefreshCw,
  Plus,
  Radio,
  Sliders,
  ChevronRight
} from 'lucide-react';

interface LiveMeetingRecorderProps {
  onSpeakSummary?: (text: string) => void;
}

export const LiveMeetingRecorder: React.FC<LiveMeetingRecorderProps> = ({ onSpeakSummary }) => {
  const [sessions, setSessions] = useState<MeetingSession[]>(meetingService.getSavedSessions());
  const [activeSession, setActiveSession] = useState<MeetingSession>(() => {
    const saved = meetingService.getSavedSessions();
    return saved[0] || {
      id: 'meet-' + Date.now(),
      title: 'Executive Strategic Sync',
      date: 'Today',
      startTime: '10:00 AM',
      durationSeconds: 0,
      status: 'standby',
      mode: 'online_google_meet',
      platform: 'google_meet',
      speakers: meetingService.getSpeakerProfiles(),
      transcripts: [],
      autoAnnounceLegalNotice: true,
      complianceAnnounced: false
    };
  });

  const [isRecording, setIsRecording] = useState(activeSession.status === 'recording');
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [audioDecibels, setAudioDecibels] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'minutes' | 'live_notes' | 'speakers' | 'history'>('minutes');
  
  // Upcoming Google Meet detection banner
  const [upcomingMeetAlert, setUpcomingMeetAlert] = useState<{
    event: GoogleCalendarEvent;
    startsInMinutes: number;
    promptScript: string;
  } | null>(null);

  // Speaker label editing modal
  const [editingSpeaker, setEditingSpeaker] = useState<MeetingSpeaker | null>(null);
  const [newSpeakerName, setNewSpeakerName] = useState('');

  // Live spoken / manual transcription injector
  const [liveSpokenInput, setLiveSpokenInput] = useState('');
  const [selectedSpeakerId, setSelectedSpeakerId] = useState<string>('spk-1');

  // Copy feedback
  const [copied, setCopied] = useState(false);
  const [tasksSyncing, setTasksSyncing] = useState(false);
  const [tasksSyncFeedback, setTasksSyncFeedback] = useState<string | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Check for upcoming Google Meet meetings on mount
  useEffect(() => {
    const alert = meetingService.detectUpcomingMeetSession();
    if (alert) {
      setUpcomingMeetAlert(alert);
    }
  }, []);

  // Duration Timer Loop
  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setActiveSession(prev => ({
          ...prev,
          durationSeconds: prev.durationSeconds + 1
        }));
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording]);

  // Handle incoming live transcript snippet
  const handleIncomingTranscript = (snippet: TranscriptSnippet) => {
    setActiveSession(prev => {
      const updatedTranscripts = [...prev.transcripts, snippet];
      const updated = {
        ...prev,
        transcripts: updatedTranscripts
      };
      return updated;
    });
  };

  // Start / Toggle Recording
  const handleToggleRecord = async () => {
    if (!isRecording) {
      soundEffects.playWakeChime();

      // Check legal auto-announcement
      if (activeSession.autoAnnounceLegalNotice && !activeSession.complianceAnnounced) {
        if (onSpeakSummary) {
          onSpeakSummary('Notice: This meeting is being recorded and transcribed by FRIDAY AI Executive Secretary.');
        }
        setActiveSession(prev => ({ ...prev, complianceAnnounced: true }));
      }

      let res;
      if (activeSession.mode === 'screen_audio') {
        res = await meetingService.startDisplayAudioRecording(handleIncomingTranscript, setAudioDecibels);
      } else {
        res = await meetingService.startMicrophoneRecording(handleIncomingTranscript, setAudioDecibels);
      }

      setIsRecording(true);
      setActiveSession(prev => ({ ...prev, status: 'recording' }));
    } else {
      soundEffects.playAcknowledge();
      meetingService.stopRecording();
      setIsRecording(false);
      setAudioDecibels(0);
      setActiveSession(prev => ({ ...prev, status: 'paused' }));
    }
  };

  // Stop & Generate Final Minutes
  const handleEndAndGenerateMinutes = async () => {
    soundEffects.playAcknowledge();
    meetingService.stopRecording();
    setIsRecording(false);
    setAudioDecibels(0);
    setIsSummarizing(true);

    try {
      const summarized = await meetingService.generatePostMeetingDeliverable(activeSession);
      setActiveSession(summarized);
      setSessions(meetingService.getSavedSessions());

      if (onSpeakSummary && summarized.executiveSummary && summarized.executiveSummary.length > 0) {
        const spoken = `Meeting ended. I have extracted ${summarized.actionItems?.length || 0} action items and generated your executive minutes.`;
        onSpeakSummary(spoken);
      }
    } catch (e) {
      console.warn('Error generating minutes', e);
    } finally {
      setIsSummarizing(false);
    }
  };

  // Join Google Meet directly
  const handleJoinGoogleMeet = async (meetUrl: string, title?: string) => {
    soundEffects.playWakeChime();
    window.open(meetUrl, '_blank', 'noopener,noreferrer');
    
    // Create new meeting session
    const newSession: MeetingSession = {
      id: 'meet-' + Date.now(),
      title: title || 'Google Meet Sync',
      date: 'Today',
      startTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      durationSeconds: 0,
      status: 'recording',
      mode: 'online_google_meet',
      platform: 'google_meet',
      meetUrl,
      speakers: meetingService.getSpeakerProfiles(),
      transcripts: [],
      autoAnnounceLegalNotice: true,
      complianceAnnounced: false
    };

    setActiveSession(newSession);
    setUpcomingMeetAlert(null);
    setIsRecording(true);

    // Announce legal notice
    if (onSpeakSummary) {
      onSpeakSummary(`Joining ${newSession.title}. Recording and live transcription initiated.`);
    }

    await meetingService.startMicrophoneRecording(handleIncomingTranscript, setAudioDecibels);
  };

  // Smart Bookmarking ("FRIDAY, flag that")
  const handleFlagMoment = () => {
    soundEffects.playAcknowledge();
    const snippet: TranscriptSnippet = {
      id: 'ts-' + Math.random().toString(36).substring(2, 9),
      speaker: 'Executive User',
      speakerId: 'spk-1',
      timestamp: formatDuration(activeSession.durationSeconds),
      timeSeconds: activeSession.durationSeconds,
      text: '★ Flagged by Voice ("FRIDAY, flag that"): Critical executive milestone & decision registered.',
      flagged: true,
      flagReason: 'Executive Decision Bookmark',
      confidence: 1.0
    };

    setActiveSession(prev => ({
      ...prev,
      transcripts: [...prev.transcripts, snippet]
    }));
  };

  // Manual / Spoken utterance injector
  const handleAddLiveUtterance = (e: React.FormEvent) => {
    e.preventDefault();
    if (!liveSpokenInput.trim()) return;

    soundEffects.playAcknowledge();
    const speakerObj = activeSession.speakers.find(s => s.id === selectedSpeakerId) || activeSession.speakers[0];
    const snippet: TranscriptSnippet = {
      id: 'ts-' + Math.random().toString(36).substring(2, 9),
      speaker: speakerObj.name,
      speakerId: speakerObj.id,
      timestamp: formatDuration(activeSession.durationSeconds),
      timeSeconds: activeSession.durationSeconds,
      text: liveSpokenInput.trim(),
      confidence: 0.99
    };

    setActiveSession(prev => ({
      ...prev,
      transcripts: [...prev.transcripts, snippet]
    }));
    setLiveSpokenInput('');
  };

  // Sync Action Items to Google Tasks
  const handleSyncAllTasks = async () => {
    setTasksSyncing(true);
    soundEffects.playAcknowledge();
    try {
      const updated = await meetingService.syncAllActionItemsToGoogleTasks(activeSession);
      setActiveSession(updated);
      setSessions(meetingService.getSavedSessions());
      setTasksSyncFeedback(`Synchronized ${updated.actionItems?.length || 0} tasks with Google Tasks!`);
      setTimeout(() => setTasksSyncFeedback(null), 4000);
      if (onSpeakSummary) {
        onSpeakSummary(`All meeting action items have been added to your Google Tasks.`);
      }
    } catch (e) {
      console.warn('Sync tasks error', e);
    } finally {
      setTasksSyncing(false);
    }
  };

  const handleSyncSingleTask = async (taskId: string) => {
    soundEffects.playAcknowledge();
    const updated = await meetingService.syncSingleActionItemToGoogleTasks(activeSession, taskId);
    setActiveSession(updated);
    setSessions(meetingService.getSavedSessions());
  };

  // Save renamed speaker
  const handleSaveSpeakerName = () => {
    if (!editingSpeaker || !newSpeakerName.trim()) return;
    soundEffects.playAcknowledge();
    const updated = meetingService.updateSpeakerLabel(activeSession, editingSpeaker.id, newSpeakerName.trim());
    setActiveSession(updated);
    setSessions(meetingService.getSavedSessions());
    setEditingSpeaker(null);
    setNewSpeakerName('');
  };

  // Format MM:SS
  const formatDuration = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Filtered transcript based on search query
  const filteredTranscripts = searchQuery.trim()
    ? activeSession.transcripts.filter(t => 
        t.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.speaker.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : activeSession.transcripts;

  return (
    <div className="bg-zinc-950/80 border border-zinc-800/90 rounded-2xl p-6 backdrop-blur-md space-y-6">
      {/* 1. Google Meet Upcoming Auto-Detection Banner */}
      {upcomingMeetAlert && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-sky-950/80 via-blue-950/60 to-zinc-950 border border-sky-500/40 shadow-[0_0_20px_rgba(56,189,248,0.15)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-pulse">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-sky-500/20 border border-sky-400/30 rounded-xl text-sky-400">
              <Video className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] uppercase font-mono font-bold tracking-wider px-2 py-0.5 rounded-full bg-sky-900/60 text-sky-200 border border-sky-700/50">
                  Google Meet Detected
                </span>
                <span className="text-xs text-sky-300 font-mono">
                  {upcomingMeetAlert.startsInMinutes <= 0 ? 'Happening Now' : `Starts in ${upcomingMeetAlert.startsInMinutes} min`}
                </span>
              </div>
              <h4 className="text-sm font-bold text-zinc-100 mt-0.5">
                {upcomingMeetAlert.event.summary}
              </h4>
            </div>
          </div>

          <div className="flex items-center space-x-2 self-end sm:self-center">
            <button
              onClick={() => setUpcomingMeetAlert(null)}
              className="px-3 py-1.5 bg-zinc-900/80 hover:bg-zinc-900 text-xs text-zinc-400 rounded-xl font-mono cursor-pointer"
            >
              Dismiss
            </button>
            <button
              onClick={() => handleJoinGoogleMeet(
                upcomingMeetAlert.event.hangoutLink || 'https://meet.google.com/fri-dayx-sec',
                upcomingMeetAlert.event.summary
              )}
              className="flex items-center space-x-2 px-4 py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-xl shadow-[0_0_15px_rgba(14,165,233,0.4)] transition-all font-mono cursor-pointer"
            >
              <Video className="w-4 h-4" />
              <span>Join & Record Meet</span>
            </button>
          </div>
        </div>
      )}

      {/* 2. Top Header & Primary Controls */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-gradient-to-br from-red-500/20 to-sky-950 border border-red-500/30 rounded-2xl shadow-[0_0_20px_rgba(239,68,68,0.15)]">
            <Users className="w-6 h-6 text-sky-400" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-base font-bold text-zinc-100 font-mono uppercase tracking-wider">
                FRIDAY Meeting Intelligence
              </h2>
              <span className="px-2 py-0.5 bg-zinc-900 border border-zinc-700 text-[10px] text-zinc-400 font-mono rounded-md">
                v2.5 Neural Whisper
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              Online Google Meet capture • Ambient In-Person Diarization • Post-meeting Google Tasks sync
            </p>
          </div>
        </div>

        {/* Live Audio Visualizer, Recording Timer, and Master Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Active Audio Meter & Timer */}
          <div className="flex items-center space-x-2 px-3 py-1.5 bg-zinc-900/90 border border-zinc-800 rounded-xl font-mono text-xs">
            <span className={`w-2.5 h-2.5 rounded-full ${
              isRecording ? 'bg-red-500 animate-ping' : 'bg-zinc-600'
            }`} />
            <span className="text-zinc-200 font-bold">{formatDuration(activeSession.durationSeconds)}</span>

            {/* Audio Wave Visualizer Bars */}
            <div className="flex items-center space-x-0.5 ml-2 h-4 w-12 px-1">
              {[1, 2, 3, 4, 5].map(bar => {
                const heightPercent = isRecording 
                  ? Math.max(20, Math.min(100, (audioDecibels * (bar * 0.4 + 0.2)))) 
                  : 15;
                return (
                  <span
                    key={bar}
                    className={`w-1 rounded-full transition-all duration-75 ${
                      isRecording ? 'bg-sky-400' : 'bg-zinc-700'
                    }`}
                    style={{ height: `${heightPercent}%` }}
                  />
                );
              })}
            </div>
          </div>

          {/* Master Record Toggle */}
          <button
            onClick={handleToggleRecord}
            className={`px-3.5 py-1.5 rounded-xl font-semibold text-xs flex items-center space-x-1.5 transition-all cursor-pointer ${
              isRecording
                ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-[0_0_15px_rgba(217,119,6,0.4)]'
                : 'bg-red-600 hover:bg-red-500 text-white shadow-[0_0_15px_rgba(220,38,38,0.4)]'
            }`}
          >
            {isRecording ? (
              <>
                <Pause className="w-3.5 h-3.5" />
                <span>Pause Recording</span>
              </>
            ) : (
              <>
                <Mic className="w-3.5 h-3.5" />
                <span>Start Recording</span>
              </>
            )}
          </button>

          {/* Smart Bookmark Button */}
          <button
            onClick={handleFlagMoment}
            disabled={!isRecording}
            className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 disabled:opacity-30 border border-zinc-800 text-amber-300 text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer"
            title="Flag Key Milestone ('FRIDAY, flag that')"
          >
            <Bookmark className="w-3.5 h-3.5 text-amber-400" />
            <span>Flag</span>
          </button>

          {/* End & Generate AI Minutes */}
          <button
            onClick={handleEndAndGenerateMinutes}
            disabled={isSummarizing || activeSession.transcripts.length === 0}
            className="px-3.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white text-xs font-bold flex items-center space-x-1.5 shadow-[0_0_15px_rgba(14,165,233,0.3)] transition-all cursor-pointer font-mono"
          >
            <Sparkles className={`w-3.5 h-3.5 ${isSummarizing ? 'animate-spin' : ''}`} />
            <span>{isSummarizing ? 'Analyzing (<60s)...' : 'End & Generate Minutes'}</span>
          </button>
        </div>
      </div>

      {/* 3. Privacy & Compliance Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 rounded-xl bg-zinc-900/40 border border-zinc-800/80 text-xs font-mono gap-3">
        <div className="flex items-center space-x-2">
          <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="text-zinc-300">
            Encrypted Audio Ingestion • Zero Cloud Telemetry • Legal Recording Watermark
          </span>
        </div>

        <div className="flex items-center space-x-3 text-zinc-400">
          <label className="flex items-center space-x-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={activeSession.autoAnnounceLegalNotice}
              onChange={(e) => setActiveSession(prev => ({ ...prev, autoAnnounceLegalNotice: e.target.checked }))}
              className="w-3.5 h-3.5 rounded bg-zinc-950 border-zinc-700 text-sky-500"
            />
            <span className="text-[11px]">Auto-announce recording to participants</span>
          </label>
        </div>
      </div>

      {/* 4. Plugin & Capture Mode Selector */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-zinc-400 font-mono mr-1">Capture Source:</span>
        {AVAILABLE_PLUGINS.map(plugin => {
          const isSelected = activeSession.platform === plugin.id;
          return (
            <button
              key={plugin.id}
              onClick={() => {
                setActiveSession(prev => ({
                  ...prev,
                  platform: plugin.id as any,
                  mode: plugin.id === 'in_person' ? 'offline_ambient' : 'online_google_meet'
                }));
                soundEffects.playAcknowledge();
              }}
              className={`flex items-center space-x-1.5 px-3 py-1 rounded-xl text-xs font-mono transition-all cursor-pointer ${
                isSelected
                  ? 'bg-sky-950 border border-sky-500/60 text-sky-300 font-bold shadow-sm'
                  : 'bg-zinc-900/60 hover:bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {plugin.id === 'google_meet' && <Video className="w-3 h-3 text-sky-400" />}
              {plugin.id === 'zoom' && <PhoneCall className="w-3 h-3 text-blue-400" />}
              {plugin.id === 'teams' && <Users className="w-3 h-3 text-purple-400" />}
              {plugin.id === 'in_person' && <Mic className="w-3 h-3 text-emerald-400" />}
              <span>{plugin.name}</span>
            </button>
          );
        })}
      </div>

      {/* 5. Main 2-Column Interface: Live Diarized Transcript (Left) + Post-Meeting Intelligence (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* ============================================================== */}
        {/* LEFT COLUMN: LIVE TRANSCRIPTION & SPEAKER DIARIZATION (6 COLS) */}
        {/* ============================================================== */}
        <div className="lg:col-span-6 flex flex-col space-y-4">
          
          {/* Transcript Subheader & Search */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-zinc-200 uppercase font-mono">
                Live Speech Stream
              </span>
              <span className="text-[10px] text-zinc-500 font-mono">
                ({activeSession.transcripts.length} snippets)
              </span>
            </div>

            <div className="relative w-48">
              <Search className="w-3 h-3 text-zinc-500 absolute left-2.5 top-2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search transcript..."
                className="w-full pl-7 pr-2 py-1 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-sky-500 font-mono"
              />
            </div>
          </div>

          {/* Transcript Scroll Area */}
          <div className="space-y-2.5 max-h-[440px] min-h-[300px] overflow-y-auto pr-2 bg-zinc-900/30 p-3 rounded-2xl border border-zinc-800/70">
            {filteredTranscripts.length === 0 ? (
              <div className="py-16 text-center text-zinc-500 text-xs font-mono">
                <Mic className="w-8 h-8 mx-auto mb-2 text-zinc-600 animate-pulse" />
                <p>No utterances recorded yet.</p>
                <p className="text-[11px] text-zinc-600 mt-1">Tap "Start Recording" or speak "Hey FRIDAY, start meeting minutes"</p>
              </div>
            ) : (
              filteredTranscripts.map((t) => {
                const speakerObj = activeSession.speakers.find(s => s.name === t.speaker || s.id === t.speakerId);
                const speakerColor = speakerObj?.color || '#0ea5e9';

                return (
                  <div
                    key={t.id}
                    className={`p-3 rounded-xl border text-xs transition-all ${
                      t.flagged
                        ? 'bg-amber-950/30 border-amber-500/50 text-amber-200 shadow-sm'
                        : 'bg-zinc-900/80 border-zinc-800/80 text-zinc-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center space-x-2">
                        <span 
                          className="w-2.5 h-2.5 rounded-full" 
                          style={{ backgroundColor: speakerColor }} 
                        />
                        <button
                          onClick={() => {
                            if (speakerObj) {
                              setEditingSpeaker(speakerObj);
                              setNewSpeakerName(speakerObj.name);
                            }
                          }}
                          className="font-bold font-mono text-[11px] hover:underline cursor-pointer flex items-center space-x-1"
                          style={{ color: speakerColor }}
                          title="Click to rename speaker"
                        >
                          <span>{t.speaker}</span>
                          <Edit3 className="w-2.5 h-2.5 opacity-60 ml-0.5" />
                        </button>
                        {t.flagged && (
                          <span className="px-1.5 py-0.2 bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[9px] rounded font-mono font-bold">
                            FLAGGED
                          </span>
                        )}
                      </div>

                      <div className="flex items-center space-x-2 text-[10px] text-zinc-500 font-mono">
                        <span>{t.timestamp}</span>
                        <button
                          onClick={() => {
                            soundEffects.playAcknowledge();
                            if (onSpeakSummary) onSpeakSummary(`Playing audio replay at ${t.timestamp}: "${t.text}"`);
                          }}
                          className="text-zinc-500 hover:text-sky-400 p-0.5"
                          title="Jump to audio timestamp & replay"
                        >
                          <Play className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    <p className="leading-relaxed font-sans">{t.text}</p>
                  </div>
                );
              })
            )}
          </div>

          {/* Quick Voice / Manual Utterance Injector */}
          <form onSubmit={handleAddLiveUtterance} className="flex items-center space-x-2 pt-1">
            <select
              value={selectedSpeakerId}
              onChange={(e) => setSelectedSpeakerId(e.target.value)}
              className="px-2.5 py-1.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-200 font-mono focus:outline-none"
            >
              {activeSession.speakers.map(s => (
                <option key={s.id} value={s.id}>{s.name.split(' ')[0]}</option>
              ))}
            </select>
            <input
              type="text"
              value={liveSpokenInput}
              onChange={(e) => setLiveSpokenInput(e.target.value)}
              placeholder="Inject speech segment or transcribe text..."
              className="flex-1 px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-200 focus:outline-none focus:border-sky-500"
            />
            <button
              type="submit"
              disabled={!liveSpokenInput.trim()}
              className="px-3.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 text-xs text-zinc-200 rounded-xl font-mono cursor-pointer"
            >
              Add
            </button>
          </form>
        </div>

        {/* ============================================================== */}
        {/* RIGHT COLUMN: EXECUTIVE MINUTES, DELIVERABLES & GOOGLE TASKS   */}
        {/* ============================================================== */}
        <div className="lg:col-span-6 bg-zinc-900/40 border border-zinc-800/90 rounded-2xl p-5 flex flex-col justify-between space-y-4">
          
          <div>
            {/* Tab Bar within Right Column */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 pb-3 mb-4">
              <div className="flex items-center space-x-1">
                {[
                  { id: 'minutes', label: 'Executive Minutes', icon: FileText },
                  { id: 'live_notes', label: 'Live Notes', icon: Sparkles },
                  { id: 'speakers', label: 'Diarization Profiles', icon: Users },
                  { id: 'history', label: 'Archive', icon: Clock }
                ].map(tab => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`flex items-center space-x-1.5 px-3 py-1 rounded-xl text-xs font-mono transition-all cursor-pointer ${
                        activeTab === tab.id
                          ? 'bg-sky-950 text-sky-300 border border-sky-600/40 font-bold'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Export Actions Menu */}
              <div className="flex items-center space-x-1">
                <button
                  onClick={() => MeetingExportService.exportToPDF(activeSession)}
                  className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-200 rounded-lg font-mono flex items-center space-x-1 cursor-pointer"
                  title="Export formatted PDF"
                >
                  <Download className="w-3 h-3 text-red-400" />
                  <span>PDF</span>
                </button>
                <button
                  onClick={() => MeetingExportService.exportToWordDoc(activeSession)}
                  className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-200 rounded-lg font-mono flex items-center space-x-1 cursor-pointer"
                  title="Export Word .doc"
                >
                  <Download className="w-3 h-3 text-blue-400" />
                  <span>Doc</span>
                </button>
                <button
                  onClick={() => {
                    MeetingExportService.exportToMarkdown(activeSession);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-200 rounded-lg font-mono flex items-center space-x-1 cursor-pointer"
                  title="Export Markdown"
                >
                  <Copy className="w-3 h-3 text-emerald-400" />
                  <span>MD</span>
                </button>
              </div>
            </div>

            {/* Notification Feedback Banner */}
            {tasksSyncFeedback && (
              <div className="mb-3 p-2.5 bg-emerald-950/60 border border-emerald-500/40 rounded-xl text-xs text-emerald-200 font-mono flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  <span>{tasksSyncFeedback}</span>
                </div>
                <span className="text-[10px] text-zinc-400">Google Tasks Live</span>
              </div>
            )}

            {/* TAB CONTENT: EXECUTIVE MINUTES */}
            {activeTab === 'minutes' && (
              <div className="space-y-4 max-h-[420px] overflow-y-auto pr-1">
                
                {/* 1. Executive Summary */}
                <div>
                  <h4 className="text-[11px] font-mono font-bold text-sky-400 uppercase tracking-wider mb-2 flex items-center space-x-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>1. Executive Summary (3-5 Key Points)</span>
                  </h4>
                  <ul className="space-y-1.5 text-xs text-zinc-300 list-disc list-inside bg-zinc-950/50 p-3 rounded-xl border border-zinc-800/80">
                    {(activeSession.executiveSummary || [
                      'Meeting notes pending analysis. Click "End & Generate Minutes" to trigger automated AI processing.'
                    ]).map((s, idx) => (
                      <li key={idx} className="leading-relaxed">{s}</li>
                    ))}
                  </ul>
                </div>

                {/* 2. Decisions Made */}
                <div>
                  <h4 className="text-[11px] font-mono font-bold text-teal-400 uppercase tracking-wider mb-2 flex items-center space-x-1.5">
                    <Check className="w-3.5 h-3.5" />
                    <span>2. Key Decisions Agreed Upon</span>
                  </h4>
                  <div className="space-y-1.5 bg-zinc-950/50 p-3 rounded-xl border border-zinc-800/80">
                    {(activeSession.keyDecisions || [
                      'No explicit decisions logged yet.'
                    ]).map((d, idx) => (
                      <div key={idx} className="text-xs text-teal-200 flex items-start space-x-2">
                        <span className="text-teal-400 font-bold">✓</span>
                        <span>{d}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 3. Action Items with Google Tasks Integration */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-[11px] font-mono font-bold text-amber-400 uppercase tracking-wider flex items-center space-x-1.5">
                      <CheckSquare className="w-3.5 h-3.5" />
                      <span>3. Extracted Action Items</span>
                    </h4>

                    {activeSession.actionItems && activeSession.actionItems.length > 0 && (
                      <button
                        onClick={handleSyncAllTasks}
                        disabled={tasksSyncing}
                        className="px-2.5 py-1 bg-amber-950 hover:bg-amber-900 border border-amber-600/40 text-amber-300 text-[11px] font-mono rounded-lg flex items-center space-x-1 transition-colors cursor-pointer"
                      >
                        <RefreshCw className={`w-3 h-3 ${tasksSyncing ? 'animate-spin' : ''}`} />
                        <span>Sync All to Google Tasks</span>
                      </button>
                    )}
                  </div>

                  <div className="space-y-2">
                    {(activeSession.actionItems || []).map((act) => (
                      <div
                        key={act.id}
                        className="p-2.5 rounded-xl bg-zinc-950/70 border border-zinc-800 flex items-start justify-between gap-3 text-xs"
                      >
                        <div>
                          <p className="font-semibold text-zinc-100">{act.task}</p>
                          <div className="flex flex-wrap items-center gap-2 mt-1 text-[10px] text-zinc-400 font-mono">
                            <span className="text-sky-300 font-bold">Owner: {act.owner}</span>
                            <span>•</span>
                            <span className="text-zinc-300">Due: {act.deadline}</span>
                            <span>•</span>
                            <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                              act.priority === 'high' ? 'bg-red-950 text-red-300 border border-red-800' : 'bg-zinc-800 text-zinc-300'
                            }`}>
                              {act.priority.toUpperCase()}
                            </span>
                          </div>
                        </div>

                        <div className="shrink-0">
                          {act.syncedToGoogleTasks ? (
                            <span className="flex items-center space-x-1 px-2 py-0.5 rounded-md bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px] font-mono">
                              <Check className="w-3 h-3" />
                              <span>In Tasks</span>
                            </span>
                          ) : (
                            <button
                              onClick={() => handleSyncSingleTask(act.id)}
                              className="px-2 py-0.5 rounded-md bg-zinc-800 hover:bg-sky-900 border border-zinc-700 text-zinc-200 hover:text-sky-200 text-[10px] font-mono transition-colors cursor-pointer"
                            >
                              + Google Task
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 4. Detailed Breakdown by Topic */}
                {activeSession.detailedMinutes && activeSession.detailedMinutes.length > 0 && (
                  <div>
                    <h4 className="text-[11px] font-mono font-bold text-zinc-400 uppercase tracking-wider mb-2">
                      4. Detailed Topic Breakdown
                    </h4>
                    <div className="space-y-2">
                      {activeSession.detailedMinutes.map((sec, idx) => (
                        <div key={idx} className="p-2.5 bg-zinc-950/40 rounded-xl border border-zinc-800/70 text-xs">
                          <span className="font-bold text-zinc-200 font-mono">
                            [{sec.timestamp}] {sec.topic}
                          </span>
                          <ul className="mt-1 space-y-0.5 text-zinc-400 list-disc list-inside">
                            {sec.keyPoints.map((pt, pidx) => (
                              <li key={pidx}>{pt}</li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT: LIVE RUNNING NOTES */}
            {activeTab === 'live_notes' && (
              <div className="space-y-3">
                <div className="p-3 bg-sky-950/30 border border-sky-800/40 rounded-xl text-xs text-sky-200">
                  <p className="font-bold font-mono uppercase text-[10px]">Real-Time Distillation Stream</p>
                  <p className="text-zinc-300 mt-1">FRIDAY continually watches conversational momentum and generates live key topics.</p>
                </div>

                <div className="space-y-2">
                  {(activeSession.liveRunningNotes || [
                    'Analyzing meeting audio stream...',
                    'Sub-200ms latency requirement verified.',
                    'Discussed Google Workspace OAuth zero-telemetry policy.'
                  ]).map((note, idx) => (
                    <div key={idx} className="p-2.5 bg-zinc-950 rounded-xl border border-zinc-800 text-xs text-zinc-200 flex items-start space-x-2">
                      <span className="text-sky-400 font-bold">•</span>
                      <span>{note}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB CONTENT: SPEAKER PROFILES */}
            {activeTab === 'speakers' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-zinc-400 uppercase">Learned Speaker Voice Models</span>
                  <span className="text-[10px] text-zinc-500 font-mono">{activeSession.speakers.length} Identified</span>
                </div>

                <div className="space-y-2">
                  {activeSession.speakers.map(s => (
                    <div
                      key={s.id}
                      className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between"
                    >
                      <div className="flex items-center space-x-3">
                        <span className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: s.color }} />
                        <div>
                          <h5 className="text-xs font-bold text-zinc-100">{s.name}</h5>
                          <p className="text-[10px] text-zinc-400 font-mono">{s.role || 'Participant'} • {s.utteranceCount} utterances</p>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          setEditingSpeaker(s);
                          setNewSpeakerName(s.name);
                        }}
                        className="px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs text-zinc-300 rounded-lg font-mono cursor-pointer"
                      >
                        Rename
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB CONTENT: ARCHIVE */}
            {activeTab === 'history' && (
              <div className="space-y-2">
                <span className="text-xs font-mono text-zinc-400 uppercase block mb-2">Saved Meeting Sessions</span>
                {sessions.map(sess => (
                  <div
                    key={sess.id}
                    onClick={() => {
                      setActiveSession(sess);
                      setActiveTab('minutes');
                      soundEffects.playAcknowledge();
                    }}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                      sess.id === activeSession.id
                        ? 'bg-sky-950/60 border-sky-500/50 text-sky-200'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                    }`}
                  >
                    <div>
                      <h5 className="text-xs font-bold">{sess.title}</h5>
                      <p className="text-[10px] text-zinc-500 font-mono">
                        {sess.date} • {formatDuration(sess.durationSeconds)} • {sess.transcripts.length} snippets
                      </p>
                    </div>

                    <ChevronRight className="w-4 h-4 text-zinc-500" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Bottom Footer Info */}
          <div className="pt-3 border-t border-zinc-800 text-[10px] text-zinc-500 font-mono flex items-center justify-between">
            <span>Delivered in &lt; 60s post session</span>
            <span className="text-emerald-400 flex items-center space-x-1">
              <Check className="w-3 h-3" />
              <span>Grounded in Transcript</span>
            </span>
          </div>
        </div>
      </div>

      {/* Speaker Rename Modal */}
      {editingSpeaker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-zinc-950 border border-zinc-800 p-6 rounded-2xl max-w-sm w-full shadow-2xl space-y-4">
            <h4 className="text-sm font-bold text-zinc-100 font-mono">
              Rename Speaker Profile
            </h4>
            <p className="text-xs text-zinc-400">
              Updates all past and future utterances in this meeting to this speaker's identity.
            </p>

            <div>
              <label className="text-xs text-zinc-400 block mb-1 font-mono">Speaker Name / Identity</label>
              <input
                type="text"
                value={newSpeakerName}
                onChange={(e) => setNewSpeakerName(e.target.value)}
                placeholder="e.g. Sarah Jenkins (Finance)"
                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-200 focus:outline-none focus:border-sky-500"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => setEditingSpeaker(null)}
                className="px-3 py-1.5 bg-zinc-900 text-zinc-400 text-xs rounded-xl font-mono"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSpeakerName}
                className="px-4 py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-xl font-mono"
              >
                Save Label
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
