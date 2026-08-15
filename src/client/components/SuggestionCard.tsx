import { useState } from 'react';
import { Lightbulb, X, Check, Clock } from 'lucide-react';

export interface Suggestion {
  id: string;
  type: string;
  priority: 'high' | 'medium' | 'low';
  title: string;
  message: string;
  action: any;
  confidence: number;
}

export function SuggestionCard({ suggestion, onAccept, onDismiss }: {
  suggestion: Suggestion;
  onAccept: (s: Suggestion) => void;
  onDismiss: (id: string) => void;
}) {
  const [isVisible, setIsVisible] = useState(true);
  
  if (!isVisible) return null;
  
  const priorityColors = {
    high: 'border-amber-500/50 bg-amber-500/10',
    medium: 'border-sky-500/50 bg-sky-500/10',
    low: 'border-slate-500/50 bg-slate-500/10'
  };
  
  return (
    <div className={`p-4 rounded-xl border ${priorityColors[suggestion.priority] || priorityColors.medium} backdrop-blur-sm animate-in slide-in-from-right`}>
      <div className="flex items-start gap-3">
        <Lightbulb className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-slate-100">{suggestion.title}</h4>
          <p className="text-xs text-slate-300 mt-1">{suggestion.message}</p>
          <div className="flex items-center gap-2 mt-3">
            <button 
              onClick={() => { onAccept(suggestion); setIsVisible(false); }}
              className="px-3 py-1.5 text-xs bg-sky-500 hover:bg-sky-400 text-white rounded-lg flex items-center gap-1 transition-colors font-medium cursor-pointer"
            >
              <Check size={12} /> Do it
            </button>
            <button 
              onClick={() => { onDismiss(suggestion.id); setIsVisible(false); }}
              className="px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg flex items-center gap-1 transition-colors font-medium cursor-pointer"
            >
              <X size={12} /> Dismiss
            </button>
            <button 
              onClick={() => setIsVisible(false)}
              className="p-1.5 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
              title="Snooze"
            >
              <Clock size={12} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SuggestionCard;
