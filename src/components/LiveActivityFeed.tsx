import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { COMPANIONS } from '../services/companionRegistry';
import { Crown, Clock, Search, Mail, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

export interface ActivityItem {
  personaId: string;
  action: string;
  status: 'running' | 'done' | 'error';
}

interface LiveActivityFeedProps {
  activities: ActivityItem[];
}

const ICON_MAP: Record<string, React.ReactNode> = {
  Crown: <Crown className="w-3.5 h-3.5" />,
  Clock: <Clock className="w-3.5 h-3.5" />,
  Search: <Search className="w-3.5 h-3.5" />,
  Mail: <Mail className="w-3.5 h-3.5" />
};

export const LiveActivityFeed: React.FC<LiveActivityFeedProps> = ({ activities }) => {
  if (!activities || activities.length === 0) return null;

  return (
    <div className="fixed top-20 left-6 z-40 space-y-2 pointer-events-none max-w-sm">
      <AnimatePresence>
        {activities.map((a, i) => {
          const companion = COMPANIONS.find(c => c.id === a.personaId) || COMPANIONS[0];
          const isRunning = a.status === 'running';
          const isDone = a.status === 'done';
          const isError = a.status === 'error';

          return (
            <motion.div
              key={`${a.personaId}-${i}`}
              initial={{ opacity: 0, x: -20, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -10, scale: 0.95 }}
              transition={{ duration: 0.25 }}
              className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl backdrop-blur-xl border shadow-lg transition-all"
              style={{
                backgroundColor: `${companion.color}15`,
                borderColor: `${companion.color}45`,
                boxShadow: `0 0 20px ${companion.color}20`
              }}
            >
              {/* Specialist Icon Badge */}
              <div
                className="w-6 h-6 rounded-lg flex items-center justify-center text-white shrink-0 shadow-sm"
                style={{ backgroundColor: companion.color }}
              >
                {ICON_MAP[companion.icon] || <Crown className="w-3.5 h-3.5" />}
              </div>

              {/* Specialist Info */}
              <div className="flex flex-col min-w-0 pr-1">
                <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-semibold">
                  {companion.name} • {companion.role}
                </span>
                <span className="text-xs font-mono text-zinc-100 truncate">
                  {a.action}
                </span>
              </div>

              {/* Status Indicator */}
              <div className="ml-auto shrink-0 flex items-center">
                {isRunning && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-400" />
                )}
                {isDone && (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 animate-in fade-in" />
                )}
                {isError && (
                  <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                )}
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};

export default LiveActivityFeed;
