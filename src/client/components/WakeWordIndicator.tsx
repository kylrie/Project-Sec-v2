import { useWakeWord } from '@/client/hooks/useWakeWord';
import { Mic, MicOff, Activity } from 'lucide-react';

export function WakeWordIndicator() {
  const { isListening, isWakeWordActive, toggleWakeWord } = useWakeWord();

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
      {/* Toggle button */}
      <button
        onClick={toggleWakeWord}
        className={`p-3 rounded-full shadow-lg transition-all ${
          isWakeWordActive 
            ? 'bg-sky-500 text-white hover:bg-sky-400' 
            : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
        }`}
        title={isWakeWordActive ? 'Disable "Hey Ahri"' : 'Enable "Hey Ahri"'}
      >
        {isWakeWordActive ? <Mic size={20} /> : <MicOff size={20} />}
      </button>

      {/* Listening indicator */}
      {isListening && (
        <div className="flex items-center gap-2 px-4 py-2 bg-slate-800/90 backdrop-blur rounded-full border border-sky-500/30 animate-in fade-in slide-in-from-bottom-2">
          <Activity size={16} className="text-sky-400 animate-pulse" />
          <span className="text-sm text-sky-100 font-medium">Listening...</span>
          <div className="flex gap-0.5">
            {[1, 2, 3].map(i => (
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
