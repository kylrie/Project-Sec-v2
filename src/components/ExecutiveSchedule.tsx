import React, { useState } from 'react';
import { CalendarEvent } from '../types/friday';
import { Calendar as CalendarIcon, Clock, MapPin, Users, Plus, AlertCircle, Video, Check, Sparkles } from 'lucide-react';

interface ExecutiveScheduleProps {
  events: CalendarEvent[];
  onAddEvent: (event: CalendarEvent) => void;
  onDeleteEvent: (id: string) => void;
}

export const ExecutiveSchedule: React.FC<ExecutiveScheduleProps> = ({
  events,
  onAddEvent,
  onDeleteEvent
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [title, setTitle] = useState('');
  const [startTime, setStartTime] = useState('02:00 PM');
  const [endTime, setEndTime] = useState('03:00 PM');
  const [location, setLocation] = useState('Google Meet');

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const newEvt: CalendarEvent = {
      id: 'evt-' + Math.random().toString(36).substring(2, 9),
      title: title.trim(),
      startTime,
      endTime,
      date: 'Today',
      location,
      type: 'meeting',
      attendees: ['You (Organizer)', 'Key Stakeholder']
    };

    onAddEvent(newEvt);
    setTitle('');
    setShowAddModal(false);
  };

  return (
    <div className="bg-zinc-950/70 border border-zinc-800/90 rounded-2xl p-5 backdrop-blur-md flex flex-col justify-between h-full">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-sky-500/10 border border-sky-500/20 rounded-lg">
              <CalendarIcon className="w-4 h-4 text-sky-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-100 uppercase tracking-wider font-mono">
                Executive Calendar & Agenda
              </h3>
              <p className="text-[11px] text-zinc-400">Proactive conflict detection & daily briefings</p>
            </div>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center space-x-1 px-2.5 py-1 bg-sky-950/60 hover:bg-sky-900/60 border border-sky-600/40 text-xs text-sky-300 rounded-lg transition-colors font-medium cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Schedule</span>
          </button>
        </div>

        {/* Proactive Secretary Insight Banner */}
        <div className="mb-4 p-3 rounded-xl bg-sky-950/30 border border-sky-800/40 flex items-start space-x-2.5">
          <Sparkles className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
          <div className="text-xs text-zinc-300">
            <span className="font-semibold text-sky-300">FRIDAY Proactive Alert: </span>
            You have a 1-hour focus gap between 12:30 PM and 1:30 PM. I have blocked this time for lunch and briefing review.
          </div>
        </div>

        {/* Events Timeline */}
        <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
          {events.map((evt) => (
            <div
              key={evt.id}
              className="p-3 rounded-xl border border-zinc-800/90 bg-zinc-900/40 hover:bg-zinc-900/70 transition-colors flex items-start justify-between group"
            >
              <div className="flex items-start space-x-3">
                <div className="flex flex-col items-center justify-center w-14 py-1 bg-zinc-950/80 rounded-lg border border-zinc-800/80 text-center font-mono">
                  <span className="text-xs font-bold text-zinc-200">{evt.startTime.split(' ')[0]}</span>
                  <span className="text-[10px] text-zinc-500">{evt.startTime.split(' ')[1]}</span>
                </div>

                <div>
                  <div className="flex items-center space-x-2">
                    <h4 className="text-xs font-semibold text-zinc-100">{evt.title}</h4>
                    {evt.isConflict && (
                      <span className="px-1.5 py-0.2 bg-amber-950 text-amber-400 border border-amber-800 text-[9px] rounded font-medium flex items-center">
                        <AlertCircle className="w-2.5 h-2.5 mr-0.5" /> Conflict
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[11px] text-zinc-400">
                    <span className="flex items-center text-zinc-500">
                      <Clock className="w-3 h-3 mr-1 text-zinc-500" />
                      {evt.startTime} - {evt.endTime}
                    </span>
                    {evt.location && (
                      <span className="flex items-center text-sky-400/80">
                        {evt.location.includes('Meet') || evt.location.includes('Zoom') ? (
                          <Video className="w-3 h-3 mr-1 text-sky-400" />
                        ) : (
                          <MapPin className="w-3 h-3 mr-1 text-zinc-500" />
                        )}
                        {evt.location}
                      </span>
                    )}
                  </div>

                  {evt.attendees && evt.attendees.length > 0 && (
                    <div className="flex items-center space-x-1 mt-1.5 text-[10px] text-zinc-500">
                      <Users className="w-2.5 h-2.5 text-zinc-600" />
                      <span>{evt.attendees.join(', ')}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center space-x-1">
                <button
                  onClick={() => onDeleteEvent(evt.id)}
                  className="text-zinc-500 hover:text-red-400 p-1 text-xs"
                  title="Remove"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-zinc-950 border border-zinc-800 p-5 rounded-2xl max-w-sm w-full shadow-2xl">
            <h4 className="text-sm font-semibold text-zinc-100 mb-3">Schedule New Calendar Event</h4>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="text-[11px] text-zinc-400 block mb-1">Event Title</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Q3 Strategic Planning"
                  className="w-full px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-sky-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-zinc-400 block mb-1">Start Time</label>
                  <input
                    type="text"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-zinc-400 block mb-1">End Time</label>
                  <input
                    type="text"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="text-[11px] text-zinc-400 block mb-1">Location / Link</label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none"
                />
              </div>
              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 bg-zinc-900 text-zinc-400 hover:text-zinc-200 text-xs rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium rounded-lg"
                >
                  Confirm Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
