import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, CornerDownLeft, Sparkles, X, Clock, Calendar, ShieldCheck, FileText } from 'lucide-react';
import { VoiceState } from '../types/friday';

interface CommandOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitCommand: (command: string) => void;
  onStartVoice: () => void;
  voiceState: VoiceState;
  wakeWord: string;
}

const QUICK_COMMANDS = [
  { icon: Clock, label: "What time is it?", query: "What time is it?" },
  { icon: Sparkles, label: "Set a 10 min timer", query: "Set a timer for 10 minutes" },
  { icon: Calendar, label: "What's on my schedule?", query: "What is on my schedule today?" },
  { icon: ShieldCheck, label: "What's the weather?", query: "What is the current weather forecast?" },
  { icon: FileText, label: "Remind me to call Mom at 5 PM", query: "Remind me to call Mom at 5 PM" },
];

export const CommandOverlay: React.FC<CommandOverlayProps> = ({
  isOpen,
  onClose,
  onSubmitCommand,
  onStartVoice,
  voiceState,
  wakeWord
}) => {
  const [inputVal, setInputVal] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputVal.trim()) {
      onSubmitCommand(inputVal.trim());
      setInputVal('');
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4 bg-black/70 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -20 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="relative w-full max-w-2xl bg-zinc-950/95 border border-sky-500/40 rounded-2xl shadow-[0_0_50px_rgba(14,165,233,0.3)] overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800 bg-zinc-900/60">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-400 animate-pulse" />
              <span className="text-xs font-mono tracking-widest text-sky-300 font-semibold uppercase">
                FRIDAY Executive HUD • Global Overlay
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-[11px] text-zinc-500 font-mono">Press ESC or click X to dismiss</span>
              <button
                onClick={onClose}
                className="p-1 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Search / Command Form */}
          <form onSubmit={handleSubmit} className="relative flex items-center p-4 border-b border-zinc-800/80">
            <button
              type="button"
              onClick={onStartVoice}
              className={`p-3 rounded-xl border transition-all cursor-pointer mr-3 ${
                voiceState === 'listening'
                  ? 'bg-sky-500 text-white border-sky-400 shadow-[0_0_20px_#38bdf8]'
                  : 'bg-zinc-900 text-sky-400 border-zinc-800 hover:border-sky-500/50'
              }`}
              title="Voice Input"
            >
              <Mic className="w-5 h-5" />
            </button>

            <input
              type="text"
              autoFocus
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              placeholder={`Ask FRIDAY or type a command (or say "${wakeWord}")...`}
              className="flex-1 bg-transparent text-lg text-zinc-100 placeholder-zinc-500 focus:outline-none font-sans"
            />

            <button
              type="submit"
              disabled={!inputVal.trim()}
              className="px-3 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-30 text-white text-xs font-medium flex items-center space-x-1 transition-all"
            >
              <span>Execute</span>
              <CornerDownLeft className="w-3.5 h-3.5" />
            </button>
          </form>

          {/* Quick Suggestions & Shortcuts */}
          <div className="p-4 bg-zinc-950/60">
            <p className="text-xs font-mono text-zinc-400 uppercase tracking-wider mb-2.5">
              Quick Secretary Commands
            </p>
            <div className="flex flex-wrap gap-2">
              {QUICK_COMMANDS.map((item, idx) => {
                const Icon = item.icon;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      onSubmitCommand(item.query);
                      onClose();
                    }}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-zinc-900/80 hover:bg-sky-950/50 border border-zinc-800 hover:border-sky-500/40 text-xs text-zinc-300 hover:text-sky-300 transition-all cursor-pointer"
                  >
                    <Icon className="w-3.5 h-3.5 text-sky-400" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
