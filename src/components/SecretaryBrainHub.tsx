import React, { useState, useEffect } from 'react';
import { 
  Brain, 
  Sparkles, 
  Compass, 
  Heart, 
  Calendar, 
  Mail, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Volume2, 
  FileText, 
  Users, 
  Phone, 
  Car, 
  Activity, 
  ShieldCheck, 
  ThumbsUp, 
  ThumbsDown,
  RefreshCw,
  Zap,
  ArrowRight,
  TrendingUp,
  AlertTriangle,
  Play,
  Bot,
  Layers,
  Crown,
  Search
} from 'lucide-react';
import { 
  HabitPattern, 
  ContactRelationship, 
  PredictiveMeetingPrep, 
  MorningBriefingV2, 
  VoiceEmotionProfile, 
  CalendarEvent, 
  MessageItem 
} from '../types/friday';
import { storageService } from '../services/storage';
import { proactiveSecretaryService } from '../services/proactiveSecretaryService';
import { SoundSynthesizer } from '../services/audioEffects';
import { COMPANIONS } from '../services/companionRegistry';
import { userMemory } from '../services/userMemory';
import { SKILLS } from '../skills';

interface SecretaryBrainHubProps {
  onSpeak: (text: string) => void;
  onBlockCalendar: (title: string, start: string, duration: number) => void;
  onOpenMessageThread?: (contactName: string) => void;
  soundSynth?: SoundSynthesizer;
}

export const SecretaryBrainHub: React.FC<SecretaryBrainHubProps> = ({
  onSpeak,
  onBlockCalendar,
  onOpenMessageThread,
  soundSynth
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'briefing' | 'habits' | 'predictive' | 'relationships' | 'emotion' | 'companions'>('briefing');
  const [briefingV2, setBriefingV2] = useState<MorningBriefingV2 | null>(null);
  const [habits, setHabits] = useState<HabitPattern[]>([]);
  const [relationships, setRelationships] = useState<ContactRelationship[]>([]);
  const [predictivePrep, setPredictivePrep] = useState<PredictiveMeetingPrep | null>(null);
  const [emotionProfile, setEmotionProfile] = useState<VoiceEmotionProfile>({
    detectedEmotion: 'focused',
    confidence: 91,
    stressScore: 28,
    adaptedToneRecommendation: 'Poised executive cadence with proactive calendar protection.',
    acousticJitterScore: 0.32
  });
  const [isLoading, setIsLoading] = useState(false);
  const [feedbackGiven, setFeedbackGiven] = useState<Record<string, 'helpful' | 'unhelpful'>>({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    const storedHabits = storageService.getHabits();
    const storedRels = storageService.getRelationships();
    const calendar = storageService.getCalendar();
    const messages = storageService.getMessages();

    setHabits(storedHabits);
    setRelationships(storedRels);

    // Generate morning briefing
    const briefing = await proactiveSecretaryService.generateMorningBriefingV2(calendar, messages);
    setBriefingV2(briefing);

    // Assemble predictive prep for next meeting
    const prep = await proactiveSecretaryService.assemblePredictivePrep(calendar[1]?.title || 'Product & Engineering Architecture Review');
    setPredictivePrep(prep);

    setIsLoading(false);
  };

  const handleFeedback = (id: string, rating: 'helpful' | 'unhelpful') => {
    soundSynth?.playBeep();
    setFeedbackGiven(prev => ({ ...prev, [id]: rating }));
    proactiveSecretaryService.submitFeedback(id, rating);
  };

  const toggleHabitStatus = (habitId: string) => {
    soundSynth?.playBeep();
    const updated = habits.map(h => {
      if (h.id === habitId) {
        const nextStatus = h.status === 'active' ? 'disabled' : 'active';
        return { ...h, status: nextStatus as 'active' | 'disabled' };
      }
      return h;
    });
    setHabits(updated);
    storageService.saveHabits(updated);
  };

  const handleExecuteHabitAction = (habit: HabitPattern) => {
    soundSynth?.playActivate();
    if (habit.type === 'calendar') {
      onBlockCalendar('Focus & Weekly Executive Review', '04:00 PM', 120);
      onSpeak("I've reserved Friday 4:00 PM to 6:00 PM for deep focus and weekly decompression.");
    } else if (habit.type === 'communication') {
      onSpeak("Initiating secure cellular connection to Mom.");
    } else if (habit.type === 'health') {
      onBlockCalendar('Executive Fitness & Rebalancing', '02:00 PM', 60);
      onSpeak("I've protected your 2:00 PM slot for a 45-minute workout.");
    }
  };

  return (
    <div id="secretary-brain-hub" className="space-y-4">
      {/* Sleek Sub-Navigation Pills */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-1.5 bg-zinc-900/70 rounded-2xl border border-zinc-800/80 backdrop-blur-md">
        <div className="flex items-center gap-2 pl-2 text-xs font-mono text-cyan-400">
          <Brain className="w-4 h-4 text-cyan-400" />
          <span className="font-semibold text-zinc-200">Secretary Intelligence</span>
        </div>

        <div className="flex flex-wrap gap-1">
          <button
            id="tab-briefing-v2"
            onClick={() => { soundSynth?.playBeep(); setActiveSubTab('briefing'); }}
            className={`px-3 py-1.5 text-xs font-mono rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === 'briefing'
                ? 'bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/20'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Briefing 2.0
          </button>
          <button
            id="tab-habits"
            onClick={() => { soundSynth?.playBeep(); setActiveSubTab('habits'); }}
            className={`px-3 py-1.5 text-xs font-mono rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === 'habits'
                ? 'bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/20'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            Habit Learning
          </button>
          <button
            id="tab-predictive"
            onClick={() => { soundSynth?.playBeep(); setActiveSubTab('predictive'); }}
            className={`px-3 py-1.5 text-xs font-mono rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === 'predictive'
                ? 'bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/20'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            Predictive Prep
          </button>
          <button
            id="tab-relationships"
            onClick={() => { soundSynth?.playBeep(); setActiveSubTab('relationships'); }}
            className={`px-3 py-1.5 text-xs font-mono rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === 'relationships'
                ? 'bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/20'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
            }`}
          >
            <Heart className="w-3.5 h-3.5" />
            VIP Contacts
          </button>
          <button
            id="tab-emotion"
            onClick={() => { soundSynth?.playBeep(); setActiveSubTab('emotion'); }}
            className={`px-3 py-1.5 text-xs font-mono rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === 'emotion'
                ? 'bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/20'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            Emotional Tone
          </button>
          <button
            id="tab-companions"
            onClick={() => { soundSynth?.playBeep(); setActiveSubTab('companions'); }}
            className={`px-3 py-1.5 text-xs font-mono rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === 'companions'
                ? 'bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/20'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
            }`}
          >
            <Bot className="w-3.5 h-3.5 text-emerald-400" />
            Specialists & Skills
          </button>
        </div>
      </div>

      {/* SUB-TAB 1: MORNING BRIEFING 2.0 */}
      {activeSubTab === 'briefing' && (
        <div className="space-y-5 animate-in fade-in duration-300">
          {/* Main Vocal Briefing Card */}
          <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900/90 to-slate-950 border border-cyan-500/30 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-80 h-80 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-400 shadow-md shadow-cyan-500/10">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    Executive Morning Briefing 2.0
                    <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                      Live AI Synthesis
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">Contextual synthesis of schedule, traffic telemetry, urgent inbox & wellness</p>
                </div>
              </div>

              <button
                id="btn-play-briefing-v2"
                onClick={() => {
                  soundSynth?.playActivate();
                  if (briefingV2) onSpeak(briefingV2.vocalScript);
                }}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-sm shadow-lg shadow-cyan-500/25 flex items-center gap-2 transition-all cursor-pointer"
              >
                <Volume2 className="w-4 h-4" />
                Play Spoken Briefing
              </button>
            </div>

            {/* Natural Vocal Script Box */}
            <div className="mt-5 p-4 rounded-xl bg-slate-950/70 border border-cyan-500/20 text-slate-200 text-sm leading-relaxed font-sans flex items-start gap-3">
              <div className="mt-0.5 text-cyan-400 font-mono text-xs font-bold">FRIDAY:</div>
              <p className="italic text-cyan-100/90 font-medium">
                "{briefingV2?.vocalScript || 'Good morning. You have 4 meetings. Traffic is heavy to the 9 AM. You have 2 urgent emails. Also, you have not worked out in 3 days — your 2 PM slot is free.'}"
              </p>
            </div>

            {/* 4 Multi-faceted Telemetry Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-5">
              {/* Card 1: Meetings */}
              <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800">
                <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
                  <span className="flex items-center gap-1.5 text-cyan-400 font-semibold">
                    <Calendar className="w-3.5 h-3.5" />
                    Executive Agenda
                  </span>
                  <span className="font-mono text-white font-bold">{briefingV2?.meetingsCount || 4} Today</span>
                </div>
                <div className="text-sm font-semibold text-white">First: 09:00 AM Sync</div>
                <p className="text-xs text-slate-400 mt-1">Executive Boardroom & Live Meet</p>
              </div>

              {/* Card 2: Traffic */}
              <div className="p-4 rounded-xl bg-slate-950/50 border border-amber-500/20">
                <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
                  <span className="flex items-center gap-1.5 text-amber-400 font-semibold">
                    <Car className="w-3.5 h-3.5" />
                    Route Telemetry
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-400 font-bold">
                    Heavy Traffic
                  </span>
                </div>
                <div className="text-sm font-semibold text-white">35 Min Commute (FDR)</div>
                <p className="text-xs text-amber-300/80 mt-1">Leave by 8:20 AM to arrive on time</p>
              </div>

              {/* Card 3: Urgent Inbox */}
              <div className="p-4 rounded-xl bg-slate-950/50 border border-rose-500/20">
                <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
                  <span className="flex items-center gap-1.5 text-rose-400 font-semibold">
                    <Mail className="w-3.5 h-3.5" />
                    Priority Inbox
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-rose-500/10 text-rose-400 font-bold">
                    2 Urgent
                  </span>
                </div>
                <div className="text-sm font-semibold text-white truncate">Sarah Jenkins (Budget)</div>
                <p className="text-xs text-slate-400 mt-1">Elena Vance (Neural Model)</p>
              </div>

              {/* Card 4: Health & Habit Gap */}
              <div className="p-4 rounded-xl bg-slate-950/50 border border-emerald-500/20">
                <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
                  <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                    <Activity className="w-3.5 h-3.5" />
                    Habit Gap
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400 font-bold">
                    3-Day Gap
                  </span>
                </div>
                <div className="text-sm font-semibold text-emerald-400">2:00 PM Slot Available</div>
                <p className="text-xs text-slate-400 mt-1">Recommended: 45m Fitness</p>
              </div>
            </div>

            {/* Quick Feedback on Briefing */}
            <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
              <span>Was this morning briefing helpful?</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleFeedback('morning-briefing-v2', 'helpful')}
                  className={`p-1.5 rounded-lg border transition-all flex items-center gap-1 ${
                    feedbackGiven['morning-briefing-v2'] === 'helpful'
                      ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                      : 'border-slate-800 hover:border-slate-700 text-slate-400'
                  }`}
                >
                  <ThumbsUp className="w-3.5 h-3.5" />
                  <span className="text-[11px]">Helpful</span>
                </button>
                <button
                  onClick={() => handleFeedback('morning-briefing-v2', 'unhelpful')}
                  className={`p-1.5 rounded-lg border transition-all flex items-center gap-1 ${
                    feedbackGiven['morning-briefing-v2'] === 'unhelpful'
                      ? 'bg-rose-500/20 border-rose-500/50 text-rose-400'
                      : 'border-slate-800 hover:border-slate-700 text-slate-400'
                  }`}
                >
                  <ThumbsDown className="w-3.5 h-3.5" />
                  <span className="text-[11px]">Refine</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: HABIT LEARNING */}
      {activeSubTab === 'habits' && (
        <div className="space-y-4 animate-in fade-in duration-300">
          <div className="flex items-center justify-between p-4 rounded-xl bg-slate-900/60 border border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-white">Learned Executive Habits & Routines</h3>
              <p className="text-xs text-slate-400">FRIDAY continuously learns your recurring scheduling tendencies, cancellation patterns, and cadence preferences.</p>
            </div>
            <button
              onClick={async () => {
                soundSynth?.playActivate();
                setIsLoading(true);
                const calendar = storageService.getCalendar();
                const messages = storageService.getMessages();
                const discovered = await proactiveSecretaryService.discoverLearnedHabits(calendar, messages);
                setHabits(discovered);
                setIsLoading(false);
              }}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-xs font-semibold text-cyan-400 border border-cyan-500/30 flex items-center gap-1.5 transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              Run Habit Discovery
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {habits.map((habit) => (
              <div
                key={habit.id}
                className={`p-5 rounded-xl border transition-all ${
                  habit.status === 'active'
                    ? 'bg-slate-900/80 border-slate-800 hover:border-cyan-500/40 shadow-lg'
                    : 'bg-slate-950/40 border-slate-850 opacity-60'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className={`p-2 rounded-lg text-xs font-bold ${
                      habit.type === 'calendar' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' :
                      habit.type === 'communication' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                      habit.type === 'health' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                      'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                    }`}>
                      {habit.type.toUpperCase()}
                    </span>
                    <div>
                      <h4 className="text-sm font-bold text-white">{habit.title}</h4>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] text-emerald-400 font-mono font-semibold">
                          {habit.confidenceScore}% Confidence
                        </span>
                        <span className="text-[10px] text-slate-400">• {habit.occurrenceCount} Observations</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => toggleHabitStatus(habit.id)}
                    className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all ${
                      habit.status === 'active'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30'
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                    }`}
                  >
                    {habit.status === 'active' ? 'Active Habit' : 'Disabled'}
                  </button>
                </div>

                <p className="text-xs text-slate-300 mt-3 leading-relaxed">
                  {habit.description}
                </p>

                {/* Spoken Prompt Preview */}
                <div className="mt-3 p-2.5 rounded-lg bg-slate-950/60 border border-cyan-500/15 text-xs text-cyan-300/90 italic flex items-center gap-2">
                  <Volume2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span>"{habit.voicePrompt}"</span>
                </div>

                {/* Actions */}
                <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
                  <div className="text-[11px] text-slate-400">
                    Accepted <strong className="text-white">{habit.acceptedCount}</strong> times
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        soundSynth?.playActivate();
                        onSpeak(habit.voicePrompt);
                      }}
                      className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-all flex items-center gap-1"
                    >
                      <Play className="w-3 h-3" />
                      Test Voice
                    </button>
                    <button
                      onClick={() => handleExecuteHabitAction(habit)}
                      className="px-3 py-1 text-xs font-bold rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition-all flex items-center gap-1 shadow-md shadow-cyan-500/20"
                    >
                      <CheckCircle2 className="w-3 h-3" />
                      Apply Now
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUB-TAB 3: PREDICTIVE PREPARATION */}
      {activeSubTab === 'predictive' && (
        <div className="space-y-5 animate-in fade-in duration-300">
          <div className="p-6 rounded-2xl bg-slate-900/80 border border-cyan-500/30 shadow-xl">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 text-xs font-bold uppercase rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                    Upcoming in 10 Minutes
                  </span>
                  <h3 className="text-lg font-bold text-white">
                    {predictivePrep?.meetingTitle || 'Product & Engineering Architecture Review'}
                  </h3>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Predictive dossier auto-assembled from prior minutes, urgent inbox threads, and required PDF deliverables.
                </p>
              </div>

              <button
                onClick={() => {
                  soundSynth?.playActivate();
                  if (predictivePrep) onSpeak(predictivePrep.spokenSummary);
                }}
                className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-cyan-500/20 transition-all"
              >
                <Volume2 className="w-4 h-4" />
                Read Spoken Dossier
              </button>
            </div>

            {/* Vocal Summary Banner */}
            <div className="mt-4 p-3.5 rounded-xl bg-slate-950/70 border border-cyan-500/20 text-xs text-cyan-200 font-medium italic flex items-center gap-2.5">
              <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>"{predictivePrep?.spokenSummary || "You're meeting with Acme Corp in 10 minutes. Last meeting, they asked for the budget. Here's that doc."}"</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5">
              {/* Left Column: Relevant Emails & Past Decisions */}
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800">
                  <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5 mb-3">
                    <Mail className="w-3.5 h-3.5" />
                    Relevant Thread Signals
                  </h4>
                  {predictivePrep?.relevantEmails.map((email, idx) => (
                    <div key={idx} className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-xs space-y-1">
                      <div className="font-semibold text-white">{email.subject}</div>
                      <div className="text-slate-400 text-[11px]">From: {email.from} • {email.date}</div>
                      <p className="text-slate-300 text-[11px] italic">"{email.snippet}"</p>
                    </div>
                  ))}
                </div>

                <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800">
                  <h4 className="text-xs font-bold text-purple-400 uppercase tracking-wider flex items-center gap-1.5 mb-3">
                    <FileText className="w-3.5 h-3.5" />
                    Prior Meeting Commitments
                  </h4>
                  <div className="text-xs text-slate-300 space-y-2">
                    <div className="font-medium text-slate-200">{predictivePrep?.priorMeetingMinutes?.topic}</div>
                    <ul className="list-disc list-inside text-slate-400 space-y-1 text-[11px]">
                      {predictivePrep?.priorMeetingMinutes?.decisions.map((dec, i) => (
                        <li key={i}>{dec}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              {/* Right Column: Suggested Agenda & Required Documents */}
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800">
                  <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5 mb-3">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Auto-Assembled Agenda
                  </h4>
                  <ul className="space-y-2 text-xs">
                    {predictivePrep?.suggestedAgendaItems.map((item, idx) => (
                      <li key={idx} className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800/80 text-slate-200 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800">
                  <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5 mb-3">
                    <FileText className="w-3.5 h-3.5" />
                    Required Documents & Decks
                  </h4>
                  <div className="space-y-2">
                    {predictivePrep?.requiredDocuments.map((doc, idx) => (
                      <div key={idx} className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-cyan-400" />
                          <span className="font-semibold text-white">{doc.title}</span>
                        </div>
                        <button
                          onClick={() => {
                            soundSynth?.playActivate();
                            onSpeak(`Opening ${doc.title}`);
                          }}
                          className="px-2.5 py-1 text-[11px] font-bold rounded bg-slate-800 hover:bg-slate-700 text-cyan-400 transition-all"
                        >
                          View Doc
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 4: RELATIONSHIP MANAGEMENT & VIP CADENCE */}
      {activeSubTab === 'relationships' && (
        <div className="space-y-4 animate-in fade-in duration-300">
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white">Relationship Intelligence & Interaction Cadence</h3>
              <p className="text-xs text-slate-400">Maintains importance scores and alerts you when critical collaborator relationships go dormant.</p>
            </div>
            <div className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-lg border border-emerald-500/20">
              4 VIP Contacts Tracked
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {relationships.map((rel) => {
              const daysSince = Math.round((Date.now() - rel.lastInteractedAt) / (1000 * 60 * 60 * 24));
              const isOverdue = daysSince > rel.recommendedCadenceDays;

              return (
                <div
                  key={rel.id}
                  className={`p-5 rounded-xl border transition-all ${
                    rel.relationshipStatus === 'needs_attention'
                      ? 'bg-slate-900/90 border-amber-500/40 shadow-lg shadow-amber-500/5'
                      : rel.relationshipStatus === 'dormant'
                      ? 'bg-slate-900/60 border-rose-500/30'
                      : 'bg-slate-900/70 border-slate-800'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-white">{rel.contactName}</h4>
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                          {rel.importanceScore}/100 VIP
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">{rel.organization || rel.email}</p>
                    </div>

                    <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded ${
                      rel.relationshipStatus === 'healthy' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                      rel.relationshipStatus === 'needs_attention' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                      'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    }`}>
                      {rel.relationshipStatus === 'needs_attention' ? 'Needs Attention' : rel.relationshipStatus}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-3 p-2.5 rounded-lg bg-slate-950/60 text-xs">
                    <div>
                      <span className="text-slate-400">Last Contact:</span>
                      <div className={`font-semibold ${isOverdue ? 'text-amber-400' : 'text-slate-200'}`}>
                        {daysSince === 0 ? 'Today' : `${daysSince} days ago`}
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-400">Target Cadence:</span>
                      <div className="font-semibold text-slate-200">Every {rel.recommendedCadenceDays} days</div>
                    </div>
                  </div>

                  {rel.suggestedNudge && (
                    <div className="mt-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200">
                      <div className="font-bold flex items-center gap-1.5 text-amber-400 mb-1">
                        <Sparkles className="w-3.5 h-3.5" />
                        Secretary Suggestion:
                      </div>
                      "{rel.suggestedNudge}"
                    </div>
                  )}

                  <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
                    <button
                      onClick={() => {
                        soundSynth?.playActivate();
                        if (rel.suggestedNudge) onSpeak(rel.suggestedNudge);
                      }}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-200 transition-all flex items-center gap-1"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                      Speak Nudge
                    </button>
                    <button
                      onClick={() => {
                        soundSynth?.playActivate();
                        if (onOpenMessageThread) onOpenMessageThread(rel.contactName);
                        onSpeak(`Drafting quick message to ${rel.contactName}`);
                      }}
                      className="px-3 py-1.5 text-xs font-bold rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition-all flex items-center gap-1"
                    >
                      <Mail className="w-3.5 h-3.5" />
                      Reach Out
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SUB-TAB 5: EMOTIONAL TONE & ACOUSTIC AWARENESS */}
      {activeSubTab === 'emotion' && (
        <div className="space-y-5 animate-in fade-in duration-300">
          <div className="p-6 rounded-2xl bg-slate-900/80 border border-cyan-500/30 shadow-xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-purple-500/20 border border-purple-400/30 text-purple-400">
                  <Activity className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Emotional Awareness & Tone Modulation</h3>
                  <p className="text-xs text-slate-400">Acoustic pitch jitter analysis, speech cadence velocity, and adaptive empathy responses.</p>
                </div>
              </div>

              <div className="px-3 py-1 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-cyan-400">
                Acoustic Sensor: Active (WebAudio VAD)
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5">
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                <div className="text-xs text-slate-400">Detected User Emotion</div>
                <div className="text-2xl font-bold text-cyan-400 capitalize mt-1 flex items-center gap-2">
                  {emotionProfile.detectedEmotion}
                  <span className="text-xs font-normal text-slate-400">({emotionProfile.confidence}%)</span>
                </div>
                <p className="text-xs text-slate-400 mt-2">Speech pace: 145 WPM (Optimal)</p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                <div className="text-xs text-slate-400">Stress & Cognitive Load Score</div>
                <div className="text-2xl font-bold text-emerald-400 mt-1">
                  {emotionProfile.stressScore}/100 <span className="text-xs font-normal text-slate-400">(Low Tension)</span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full mt-3 overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-emerald-500 via-amber-500 to-rose-500 h-full rounded-full transition-all"
                    style={{ width: `${emotionProfile.stressScore}%` }}
                  />
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                <div className="text-xs text-slate-400">Acoustic Jitter Variation</div>
                <div className="text-2xl font-bold text-purple-400 mt-1 font-mono">
                  {emotionProfile.acousticJitterScore} ms
                </div>
                <p className="text-xs text-slate-400 mt-2">Harmonic ratio: Stable 0.94</p>
              </div>
            </div>

            {/* Test Stress Simulation Buttons */}
            <div className="mt-5 p-4 rounded-xl bg-slate-950/70 border border-slate-800">
              <div className="text-xs font-bold text-white mb-2">Simulate Emotional State Adaptations:</div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={async () => {
                    soundSynth?.playActivate();
                    const profile = await proactiveSecretaryService.analyzeEmotionalTone("I'm overwhelmed with these meetings, we need to hurry!", 0.78);
                    setEmotionProfile(profile);
                    onSpeak(profile.suggestedIntervention || "You sound tense. Want me to clear your afternoon?");
                  }}
                  className="px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 border border-rose-500/30 text-xs font-semibold transition-all"
                >
                  Trigger High Stress ("Overwhelmed")
                </button>
                <button
                  onClick={async () => {
                    soundSynth?.playActivate();
                    const profile = await proactiveSecretaryService.analyzeEmotionalTone("Long exhausting day, so tired.", 0.62);
                    setEmotionProfile(profile);
                    onSpeak("You sound fatigued. I've dimmed ambient lights and deferred non-urgent alerts.");
                  }}
                  className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/30 text-xs font-semibold transition-all"
                >
                  Trigger Fatigue ("Exhausted")
                </button>
                <button
                  onClick={async () => {
                    soundSynth?.playActivate();
                    const profile = await proactiveSecretaryService.analyzeEmotionalTone("Ready for the board review, let's execute.", 0.25);
                    setEmotionProfile(profile);
                    onSpeak("Understood. All systems primed with crisp executive briefing.");
                  }}
                  className="px-3 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 border border-cyan-500/30 text-xs font-semibold transition-all"
                >
                  Reset Calm / Focused
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 6: COMPANIONS & SKILLS */}
      {activeSubTab === 'companions' && (
        <div className="space-y-6">
          {/* Header */}
          <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-sky-950/30 to-purple-950/40 border border-emerald-500/20 backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                <Bot className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white tracking-wide">ONE AI Brain • Specialist Persona Network</h3>
                <p className="text-xs text-zinc-400 mt-0.5">Ahri delegates tasks across specialized internal cognitive hats, rendered in 3D orbit and HUD telemetry.</p>
              </div>
            </div>
          </div>

          {/* 4 Specialist Personas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {COMPANIONS.map((companion) => (
              <div 
                key={companion.id}
                className="p-4 rounded-xl backdrop-blur-md border transition-all hover:scale-[1.01]"
                style={{ 
                  backgroundColor: companion.color + '12', 
                  borderColor: companion.color + '35' 
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span 
                      className="w-3 h-3 rounded-full animate-pulse"
                      style={{ backgroundColor: companion.color }}
                    />
                    <h4 className="font-bold text-sm text-white font-mono">{companion.name}</h4>
                  </div>
                  <span 
                    className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full border"
                    style={{ 
                      color: companion.color, 
                      borderColor: companion.color + '40',
                      backgroundColor: companion.color + '20'
                    }}
                  >
                    {companion.role}
                  </span>
                </div>
                <p className="text-xs text-zinc-300 mt-2.5 leading-relaxed">{companion.systemPrompt}</p>
              </div>
            ))}
          </div>

          {/* Built-in Multi-Step Skills */}
          <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800">
            <div className="flex items-center gap-2 mb-4">
              <Layers className="w-4 h-4 text-sky-400" />
              <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono">Automated Skill Workflows</h4>
            </div>

            <div className="space-y-3">
              {SKILLS.map((skill) => (
                <div key={skill.id} className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-xs text-white">{skill.name}</span>
                    <span className="text-[10px] font-mono text-sky-400 bg-sky-950/50 px-2 py-0.5 rounded border border-sky-800/40">
                      Trigger: "{skill.triggerPhrases[0]}"
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {skill.steps.map((st, i) => (
                      <span key={i} className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800/70 text-zinc-300 border border-zinc-700/50">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        {st.description}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Persistent User Memory Profile */}
          <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-purple-400" />
                <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono">Persistent User Profile & Learned Facts</h4>
              </div>
              <span className="text-[10px] font-mono text-purple-400 bg-purple-950/50 px-2 py-0.5 rounded border border-purple-800/40">
                localStorage Synced
              </span>
            </div>

            {userMemory.getProfile().learnedFacts.length > 0 ? (
              <div className="space-y-2">
                {userMemory.getProfile().learnedFacts.map((fact, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2.5 rounded-lg bg-purple-950/20 border border-purple-800/30 text-xs text-purple-200">
                    <span>{fact.fact}</span>
                    <span className="text-[10px] font-mono text-purple-400">{(fact.confidence * 100).toFixed(0)}% conf</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-zinc-400 italic">No custom facts extracted yet. Ahri automatically learns your habits and facts from continuous conversations.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
