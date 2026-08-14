import React, { useState, useEffect } from 'react';
import { ActiveTimer, ReminderItem } from '../types/friday';
import { Clock, Plus, Trash2, CheckCircle, Circle, Play, Pause, RotateCcw, AlertTriangle, Tag } from 'lucide-react';
import { soundEffects } from '../services/audioEffects';

interface TimersAndTasksProps {
  timers: ActiveTimer[];
  reminders: ReminderItem[];
  onUpdateTimers: (timers: ActiveTimer[]) => void;
  onUpdateReminders: (reminders: ReminderItem[]) => void;
}

export const TimersAndTasks: React.FC<TimersAndTasksProps> = ({
  timers,
  reminders,
  onUpdateTimers,
  onUpdateReminders
}) => {
  const [newReminderText, setNewReminderText] = useState('');
  const [newReminderTime, setNewReminderTime] = useState('Today at 5:00 PM');
  const [newReminderPriority, setNewReminderPriority] = useState<'low' | 'medium' | 'high'>('high');
  const [activeFilter, setActiveFilter] = useState<'all' | 'work' | 'personal'>('all');

  // Live Timer Countdown Interval
  useEffect(() => {
    const interval = setInterval(() => {
      onUpdateTimers(prevTimers => {
        let changed = false;
        const updated = prevTimers.map(t => {
          if (t.isRunning && t.remainingSeconds > 0) {
            changed = true;
            const nextSec = t.remainingSeconds - 1;
            if (nextSec === 0) {
              soundEffects.playTimerAlarm();
            }
            return { ...t, remainingSeconds: nextSec };
          }
          return t;
        });
        return changed ? updated : prevTimers;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [onUpdateTimers]);

  const addCustomTimer = (seconds: number, label: string) => {
    const newT: ActiveTimer = {
      id: 'tmr-' + Math.random().toString(36).substring(2, 9),
      label,
      totalSeconds: seconds,
      remainingSeconds: seconds,
      isRunning: true,
      createdAt: Date.now()
    };
    onUpdateTimers([...timers, newT]);
  };

  const toggleTimerPause = (id: string) => {
    onUpdateTimers(timers.map(t => t.id === id ? { ...t, isRunning: !t.isRunning } : t));
  };

  const resetTimer = (id: string) => {
    onUpdateTimers(timers.map(t => t.id === id ? { ...t, remainingSeconds: t.totalSeconds, isRunning: false } : t));
  };

  const deleteTimer = (id: string) => {
    onUpdateTimers(timers.filter(t => t.id !== id));
  };

  const toggleReminder = (id: string) => {
    onUpdateReminders(reminders.map(r => r.id === id ? { ...r, completed: !r.completed } : r));
  };

  const deleteReminder = (id: string) => {
    onUpdateReminders(reminders.filter(r => r.id !== id));
  };

  const handleAddReminder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReminderText.trim()) return;

    const newR: ReminderItem = {
      id: 'rem-' + Math.random().toString(36).substring(2, 9),
      task: newReminderText.trim(),
      dueTime: newReminderTime,
      priority: newReminderPriority,
      completed: false,
      createdAt: Date.now(),
      category: activeFilter === 'all' ? 'work' : activeFilter
    };

    onUpdateReminders([newR, ...reminders]);
    setNewReminderText('');
  };

  const formatTime = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const filteredReminders = reminders.filter(r => {
    if (activeFilter === 'all') return true;
    return r.category === activeFilter;
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
      {/* Active Timers Card */}
      <div className="bg-zinc-950/70 border border-zinc-800/90 rounded-2xl p-5 backdrop-blur-md flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2.5">
              <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                <Clock className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-zinc-100 uppercase tracking-wider font-mono">
                  Active Countdown Timers
                </h3>
                <p className="text-[11px] text-zinc-400">Controlled by voice ("Set a timer for 10 min")</p>
              </div>
            </div>
            
            {/* Quick Add Presets */}
            <div className="flex items-center space-x-1.5">
              <button
                onClick={() => addCustomTimer(300, "5 Min Focus")}
                className="px-2 py-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[11px] text-zinc-300 rounded font-mono transition-colors"
              >
                +5m
              </button>
              <button
                onClick={() => addCustomTimer(600, "10 Min Timer")}
                className="px-2 py-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[11px] text-zinc-300 rounded font-mono transition-colors"
              >
                +10m
              </button>
              <button
                onClick={() => addCustomTimer(1800, "30 Min Session")}
                className="px-2 py-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[11px] text-zinc-300 rounded font-mono transition-colors"
              >
                +30m
              </button>
            </div>
          </div>

          {/* Timers List */}
          <div className="space-y-3 min-h-[160px] max-h-[260px] overflow-y-auto pr-1">
            {timers.length === 0 ? (
              <div className="h-40 flex flex-col items-center justify-center text-center p-4 border border-dashed border-zinc-800/80 rounded-xl">
                <Clock className="w-8 h-8 text-zinc-600 mb-2 opacity-50" />
                <p className="text-xs text-zinc-400 font-medium">No timers running</p>
                <p className="text-[11px] text-zinc-500 mt-0.5">Say "Hey FRIDAY, set a timer for 5 minutes" or use quick presets</p>
              </div>
            ) : (
              timers.map(timer => {
                const progressPct = ((timer.totalSeconds - timer.remainingSeconds) / timer.totalSeconds) * 100;
                const isFinished = timer.remainingSeconds === 0;

                return (
                  <div
                    key={timer.id}
                    className={`p-3.5 rounded-xl border transition-all ${
                      isFinished
                        ? 'bg-amber-950/30 border-amber-500/60 shadow-[0_0_15px_rgba(245,158,11,0.2)]'
                        : 'bg-zinc-900/60 border-zinc-800'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <span className={`w-2 h-2 rounded-full ${isFinished ? 'bg-amber-400 animate-ping' : timer.isRunning ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-500'}`} />
                        <span className="text-xs font-medium text-zinc-200">{timer.label}</span>
                      </div>
                      <span className={`font-mono text-base font-bold ${isFinished ? 'text-amber-400 animate-bounce' : 'text-zinc-100'}`}>
                        {isFinished ? 'TIME EXPIRED!' : formatTime(timer.remainingSeconds)}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden mb-2.5">
                      <div
                        className={`h-full transition-all duration-1000 ${
                          isFinished ? 'bg-amber-400' : 'bg-sky-400'
                        }`}
                        style={{ width: `${Math.min(100, progressPct)}%` }}
                      />
                    </div>

                    {/* Controls */}
                    <div className="flex items-center justify-between text-xs pt-1 border-t border-zinc-800/60">
                      <span className="text-[11px] text-zinc-500 font-mono">
                        Original: {Math.floor(timer.totalSeconds / 60)}m {timer.totalSeconds % 60}s
                      </span>
                      <div className="flex items-center space-x-2">
                        {!isFinished && (
                          <button
                            onClick={() => toggleTimerPause(timer.id)}
                            className="p-1 text-zinc-400 hover:text-sky-300 transition-colors"
                            title={timer.isRunning ? "Pause" : "Resume"}
                          >
                            {timer.isRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                          </button>
                        )}
                        <button
                          onClick={() => resetTimer(timer.id)}
                          className="p-1 text-zinc-400 hover:text-zinc-200 transition-colors"
                          title="Reset"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => deleteTimer(timer.id)}
                          className="p-1 text-zinc-400 hover:text-red-400 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Reminders & Action Items Card */}
      <div className="bg-zinc-950/70 border border-zinc-800/90 rounded-2xl p-5 backdrop-blur-md flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2.5">
              <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-zinc-100 uppercase tracking-wider font-mono">
                  Executive Action Items
                </h3>
                <p className="text-[11px] text-zinc-400">7-day rolling context with smart deadlines</p>
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center space-x-1 bg-zinc-900/90 p-1 rounded-lg border border-zinc-800 text-[11px]">
              <button
                onClick={() => setActiveFilter('all')}
                className={`px-2 py-0.5 rounded ${activeFilter === 'all' ? 'bg-zinc-800 text-sky-300 font-medium' : 'text-zinc-400'}`}
              >
                All
              </button>
              <button
                onClick={() => setActiveFilter('work')}
                className={`px-2 py-0.5 rounded ${activeFilter === 'work' ? 'bg-zinc-800 text-sky-300 font-medium' : 'text-zinc-400'}`}
              >
                Work
              </button>
              <button
                onClick={() => setActiveFilter('personal')}
                className={`px-2 py-0.5 rounded ${activeFilter === 'personal' ? 'bg-zinc-800 text-sky-300 font-medium' : 'text-zinc-400'}`}
              >
                Personal
              </button>
            </div>
          </div>

          {/* Quick Add Form */}
          <form onSubmit={handleAddReminder} className="flex items-center space-x-2 mb-3.5">
            <input
              type="text"
              value={newReminderText}
              onChange={(e) => setNewReminderText(e.target.value)}
              placeholder="Add reminder or say 'Remind me to...'"
              className="flex-1 px-3 py-1.5 bg-zinc-900/80 border border-zinc-800 rounded-lg text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-sky-500/50"
            />
            <button
              type="submit"
              disabled={!newReminderText.trim()}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-lg text-xs font-medium flex items-center space-x-1 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add</span>
            </button>
          </form>

          {/* Reminders List */}
          <div className="space-y-2.5 max-h-[230px] overflow-y-auto pr-1">
            {filteredReminders.length === 0 ? (
              <div className="h-32 flex flex-col items-center justify-center text-center p-4 border border-dashed border-zinc-800/80 rounded-xl">
                <CheckCircle className="w-6 h-6 text-zinc-600 mb-1 opacity-50" />
                <p className="text-xs text-zinc-400">All action items cleared</p>
              </div>
            ) : (
              filteredReminders.map(r => (
                <div
                  key={r.id}
                  className={`flex items-start justify-between p-2.5 rounded-xl border transition-all ${
                    r.completed
                      ? 'bg-zinc-950/40 border-zinc-900 opacity-60'
                      : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-start space-x-2.5 flex-1 pr-2">
                    <button
                      onClick={() => toggleReminder(r.id)}
                      className="mt-0.5 text-zinc-500 hover:text-emerald-400 transition-colors"
                    >
                      {r.completed ? (
                        <CheckCircle className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Circle className="w-4 h-4" />
                      )}
                    </button>
                    <div>
                      <p className={`text-xs font-medium ${r.completed ? 'line-through text-zinc-500' : 'text-zinc-200'}`}>
                        {r.task}
                      </p>
                      <div className="flex items-center space-x-2 mt-1">
                        <span className="text-[10px] text-zinc-400 font-mono">{r.dueTime}</span>
                        {r.priority === 'high' && (
                          <span className="px-1.5 py-0.2 bg-red-950/50 text-red-400 border border-red-800/40 text-[9px] rounded font-medium">
                            Urgent
                          </span>
                        )}
                        {r.category && (
                          <span className="text-[10px] text-zinc-500 capitalize flex items-center">
                            • {r.category}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => deleteReminder(r.id)}
                    className="text-zinc-600 hover:text-red-400 p-1 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
