import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { syncEngine, SyncStatusState } from '../services/syncEngine';
import { Cloud, CloudOff, RefreshCw, Check } from 'lucide-react';

export const SyncStatus: React.FC = () => {
  const [status, setStatus] = useState<SyncStatusState>(syncEngine.getStatus());
  const [isVisible, setIsVisible] = useState<boolean>(false);

  useEffect(() => {
    let hideTimer: NodeJS.Timeout;

    const unsubscribe = syncEngine.subscribeToSyncStatus((newStatus) => {
      setStatus(newStatus);
      setIsVisible(true);

      clearTimeout(hideTimer);
      if (newStatus === 'synced') {
        hideTimer = setTimeout(() => {
          setIsVisible(false);
        }, 3500);
      }
    });

    return () => {
      unsubscribe();
      clearTimeout(hideTimer);
    };
  }, []);

  const config = {
    synced: {
      color: 'border-emerald-500/40 bg-emerald-950/40 text-emerald-300',
      dot: 'bg-emerald-400',
      icon: Check,
      label: 'Cloud Synced'
    },
    syncing: {
      color: 'border-amber-500/40 bg-amber-950/40 text-amber-300',
      dot: 'bg-amber-400 animate-ping',
      icon: RefreshCw,
      label: 'Syncing...'
    },
    offline: {
      color: 'border-rose-500/40 bg-rose-950/40 text-rose-300',
      dot: 'bg-rose-400',
      icon: CloudOff,
      label: 'Offline (Queued)'
    }
  }[status];

  const Icon = config.icon;

  return (
    <div 
      className="fixed top-4 right-20 z-40"
      onMouseEnter={() => setIsVisible(true)}
    >
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.25 }}
            className={`flex items-center space-x-2 px-3 py-1 rounded-full border backdrop-blur-md font-mono text-[11px] tracking-wider shadow-lg ${config.color}`}
          >
            <span className={`w-2 h-2 rounded-full ${config.dot}`} />
            <Icon className={`w-3.5 h-3.5 ${status === 'syncing' ? 'animate-spin' : ''}`} />
            <span className="font-medium">{config.label}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
