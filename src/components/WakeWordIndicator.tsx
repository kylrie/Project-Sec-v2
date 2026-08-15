import React from 'react';
import { useWakeWord } from '../client/hooks/useWakeWord';
import { Mic, MicOff, Activity } from 'lucide-react';

export function WakeWordIndicator() {
  const { isListening, isWakeWordActive, toggleWakeWord } = useWakeWord();

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2 pointer-events-auto">
      {/* Wake word toggle */}
      <button
        onClick={toggleWakeWord}
        className={`p-3 rounded-full shadow-lg transition-all border ${
          isWakeWordActive
            ? 'bg-sky-500 hover:bg-sky-400 text-white border-sky-300/40 shadow-sky-500/30'
            : 'bg-slate-800/90 hover:bg-slate-700 text-slate-300 border-slate-700/60 shadow-black/40'
        }`}
        title={isWakeWordActive ? 'Disable "Hey Ahri" wake word' : 'Enable "Hey Ahri" wake word'}
      >
        {isWakeWordActive ? <Mic size={20} /> : <MicOff size={20} />}
      </button>

      {/* Listening indicator */}
      {isListening && (
        <div className="flex items-center gap-2 px-4 py-2 bg-slate-900/95 backdrop-blur-md rounded-full border border-sky-500/40 shadow-xl shadow-sky-500/10 animate-fade-in">
          <Activity size={16} className="text-sky-400 animate-pulse" />
          <span className="text-xs font-mono uppercase tracking-wider text-sky-200">Listening...</span>
          <div className="flex items-center gap-1">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="w-1 h-3 bg-sky-400 rounded-full animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default WakeWordIndicator;
