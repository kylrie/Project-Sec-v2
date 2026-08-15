import React, { useEffect, useState } from 'react';
import { Sparkles, Calendar, CheckSquare, Sun, Moon, ArrowRight, X, Radio } from 'lucide-react';
import { apiGet, apiPost } from '../client/services/apiClient';
import { websocketService } from '../client/services/websocketService';
import { soundSynth } from '../services/audioEffects';


export interface ProactiveSuggestionItem {
  id: string;
  title: string;
  description: string;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  category: 'calendar' | 'tasks' | 'system' | 'briefing' | 'device';
  actionIntent?: string;
  actionPayload?: any;
  spokenPrompt?: string;
}

interface ProactiveBannerProps {
  onExecuteAction?: (intent: string, payload: any) => void;
}

export const ProactiveSuggestionBanner: React.FC<ProactiveBannerProps> = ({ onExecuteAction }) => {
  const [suggestions, setSuggestions] = useState<ProactiveSuggestionItem[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  const fetchSuggestions = async () => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const res = await apiGet<{ suggestions: ProactiveSuggestionItem[] }>(`/api/proactive/suggestions?timezone=${encodeURIComponent(tz)}`);
      if (res && res.suggestions && res.suggestions.length > 0) {
        setSuggestions(res.suggestions);
        setIsVisible(true);
      }
    } catch {
      // Offline fallback
    }
  };

  useEffect(() => {
    fetchSuggestions();
    const interval = setInterval(fetchSuggestions, 120000); // Check every 2 minutes

    // Listen for live websocket suggestions
    const unsub = websocketService.connect((msg: any) => {
      if (msg && msg.type === 'PROACTIVE_SUGGESTION') {
        setSuggestions((prev) => [msg.suggestion, ...prev]);
        setIsVisible(true);
        soundSynth.playWakeChime();
      }
    });

    return () => {
      clearInterval(interval);
      unsub();
    };
  }, []);

  if (!isVisible || suggestions.length === 0) {
    return null;
  }

  const current = suggestions[activeIdx] || suggestions[0];

  const handleExecute = async () => {
    soundSynth.playAcknowledge();

    try {
      await apiPost('/api/proactive/execute', {
        suggestionId: current.id,
        actionIntent: current.actionIntent,
        actionPayload: current.actionPayload
      });
    } catch {}

    if (onExecuteAction && current.actionIntent) {
      onExecuteAction(current.actionIntent, current.actionPayload);
    }

    // Dismiss from view
    handleDismiss();
  };

  const handleDismiss = async () => {
    try {
      await apiPost('/api/proactive/dismiss', { suggestionId: current.id });
    } catch {}

    const remaining = suggestions.filter((_, i) => i !== activeIdx);
    if (remaining.length > 0) {
      setSuggestions(remaining);
      setActiveIdx(0);
    } else {
      setIsVisible(false);
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'calendar':
        return <Calendar className="w-4 h-4 text-emerald-400" />;
      case 'tasks':
        return <CheckSquare className="w-4 h-4 text-sky-400" />;
      case 'briefing':
        return <Sun className="w-4 h-4 text-amber-400" />;
      case 'device':
        return <Radio className="w-4 h-4 text-purple-400" />;
      default:
        return <Sparkles className="w-4 h-4 text-pink-400" />;
    }
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'critical':
      case 'high':
        return 'border-emerald-500/40 bg-emerald-950/40 shadow-[0_0_20px_rgba(16,185,129,0.2)]';
      case 'medium':
        return 'border-sky-500/40 bg-sky-950/40 shadow-[0_0_20px_rgba(14,165,233,0.15)]';
      default:
        return 'border-purple-500/30 bg-purple-950/30';
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 mb-4 animate-in fade-in slide-in-from-top-4 duration-300">
      <div className={`backdrop-blur-md rounded-2xl p-4 border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition-all ${getUrgencyColor(current.urgency)}`}>
        <div className="flex items-start sm:items-center space-x-3 flex-1 min-w-0">
          <div className="p-2.5 rounded-xl bg-black/40 border border-white/10 shrink-0">
            {getCategoryIcon(current.category)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-300 font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/30">
                Ahri Proactive Directive
              </span>
              <h4 className="text-xs sm:text-sm font-bold text-zinc-100 truncate">
                {current.title}
              </h4>
            </div>
            <p className="text-xs text-zinc-300 mt-0.5 line-clamp-2 sm:line-clamp-1">
              {current.description}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 self-end sm:self-center shrink-0">
          <button
            onClick={handleExecute}
            className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black font-semibold text-xs flex items-center space-x-1.5 shadow-[0_0_15px_rgba(16,185,129,0.35)] transition-all"
          >
            <span>Execute</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleDismiss}
            className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-200 hover:bg-white/5 transition-all"
            title="Dismiss suggestion"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProactiveSuggestionBanner;
