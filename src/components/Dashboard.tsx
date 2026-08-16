import React from 'react';
import { Calendar, Mail, CheckCircle2, Clock } from 'lucide-react';

export function Dashboard() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-6xl mx-auto p-6">
      
      {/* Calendar & Schedule */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 backdrop-blur-md flex flex-col h-80">
        <div className="flex items-center space-x-3 mb-6">
          <div className="p-2 bg-sky-500/10 rounded-lg">
            <Calendar className="w-5 h-5 text-sky-400" />
          </div>
          <h2 className="text-zinc-100 font-semibold tracking-wide">Today's Schedule</h2>
        </div>
        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
          {/* Mock Events */}
          <div className="flex items-start space-x-4">
            <div className="flex flex-col items-center min-w-[50px]">
              <span className="text-zinc-300 font-medium">09:00</span>
              <span className="text-xs text-zinc-500">AM</span>
            </div>
            <div className="flex-1 bg-zinc-800/50 rounded-xl p-3 border border-zinc-700/50">
              <h3 className="text-sm font-medium text-zinc-200">Executive Briefing</h3>
              <p className="text-xs text-zinc-400 mt-1 flex items-center"><Clock className="w-3 h-3 mr-1"/> 45 min</p>
            </div>
          </div>
          <div className="flex items-start space-x-4">
            <div className="flex flex-col items-center min-w-[50px]">
              <span className="text-zinc-300 font-medium">11:30</span>
              <span className="text-xs text-zinc-500">AM</span>
            </div>
            <div className="flex-1 bg-sky-900/20 rounded-xl p-3 border border-sky-800/30">
              <h3 className="text-sm font-medium text-sky-200">Product Sync</h3>
              <p className="text-xs text-sky-400/70 mt-1 flex items-center"><Clock className="w-3 h-3 mr-1"/> Google Meet</p>
            </div>
          </div>
        </div>
      </div>

      {/* Communications Triage */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 backdrop-blur-md flex flex-col h-80">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-purple-500/10 rounded-lg">
              <Mail className="w-5 h-5 text-purple-400" />
            </div>
            <h2 className="text-zinc-100 font-semibold tracking-wide">Priority Inbox</h2>
          </div>
          <span className="bg-purple-500/20 text-purple-300 text-xs px-2 py-1 rounded-full font-medium">3 Unread</span>
        </div>
        <div className="flex-1 overflow-y-auto space-y-3">
          <div className="p-3 rounded-xl border border-zinc-800 bg-zinc-950/50 hover:bg-zinc-800/50 transition-colors">
            <div className="flex justify-between items-start mb-1">
              <span className="text-sm font-medium text-zinc-200">System Security</span>
              <span className="text-xs text-zinc-500">10m ago</span>
            </div>
            <p className="text-xs text-zinc-400 line-clamp-2">OAuth token encryption verified. Zero security warnings.</p>
          </div>
          <div className="p-3 rounded-xl border border-zinc-800 bg-zinc-950/50 hover:bg-zinc-800/50 transition-colors">
            <div className="flex justify-between items-start mb-1">
              <span className="text-sm font-medium text-zinc-200">AWS Alerts</span>
              <span className="text-xs text-zinc-500">1h ago</span>
            </div>
            <p className="text-xs text-zinc-400 line-clamp-2">Billing threshold exceeded for environment: Production.</p>
          </div>
        </div>
      </div>

      {/* Tasks & Action Items */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 backdrop-blur-md flex flex-col h-80">
        <div className="flex items-center space-x-3 mb-6">
          <div className="p-2 bg-emerald-500/10 rounded-lg">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          </div>
          <h2 className="text-zinc-100 font-semibold tracking-wide">Action Items</h2>
        </div>
        <div className="flex-1 overflow-y-auto space-y-3">
          <div className="flex items-start space-x-3 group">
            <button className="mt-0.5 text-zinc-500 hover:text-emerald-400 transition-colors">
              <CheckCircle2 className="w-4 h-4" />
            </button>
            <div>
              <p className="text-sm text-zinc-200">Approve finalized Q3 budget</p>
              <p className="text-xs text-red-400 mt-0.5">Due Today</p>
            </div>
          </div>
          <div className="flex items-start space-x-3 group">
            <button className="mt-0.5 text-zinc-500 hover:text-emerald-400 transition-colors">
              <CheckCircle2 className="w-4 h-4" />
            </button>
            <div>
              <p className="text-sm text-zinc-200">Follow up with design agency</p>
              <p className="text-xs text-zinc-500 mt-0.5">Due Tomorrow</p>
            </div>
          </div>
          <div className="flex items-start space-x-3 group">
            <button className="mt-0.5 text-zinc-500 hover:text-emerald-400 transition-colors">
              <CheckCircle2 className="w-4 h-4" />
            </button>
            <div>
              <p className="text-sm text-zinc-200">Book flights for NY summit</p>
              <p className="text-xs text-zinc-500 mt-0.5">Pending approval</p>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
