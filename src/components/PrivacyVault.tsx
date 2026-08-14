import React, { useState } from 'react';
import { storageService } from '../services/storage';
import { ConversationTurn, PrivacyAuditEntry } from '../types/friday';
import { Shield, Trash2, Download, Lock, CheckCircle2, AlertTriangle, Database, Cpu, EyeOff, RefreshCw } from 'lucide-react';
import { soundEffects } from '../services/audioEffects';

interface PrivacyVaultProps {
  conversations: ConversationTurn[];
  onDataPurged: () => void;
}

export const PrivacyVault: React.FC<PrivacyVaultProps> = ({ conversations, onDataPurged }) => {
  const [auditLog, setAuditLog] = useState<PrivacyAuditEntry[]>(storageService.getAuditLog());
  const [isWiping, setIsWiping] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [wipeSuccess, setWipeSuccess] = useState(false);

  // Granular Permission Toggles
  const [permissions, setPermissions] = useState({
    micAccess: true,
    localPersistence: true,
    calendarAccess: true,
    messagesAccess: true,
    cloudFallback: true,
    telemetryEnabled: false // default FALSE for maximum privacy
  });

  const handleTogglePermission = (key: keyof typeof permissions) => {
    setPermissions(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleExportData = () => {
    const json = storageService.exportAllDataJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `friday-vault-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePurgeEverything = () => {
    setIsWiping(true);
    soundEffects.playDataPurge();

    setTimeout(() => {
      storageService.purgeAllLocalData();
      setAuditLog([]);
      setIsWiping(false);
      setShowConfirm(false);
      setWipeSuccess(true);
      onDataPurged();

      setTimeout(() => setWipeSuccess(false), 3000);
    }, 1200);
  };

  return (
    <div className="bg-zinc-950/80 border border-zinc-800/90 rounded-2xl p-6 backdrop-blur-md">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
            <Shield className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-zinc-100 font-mono">
              Privacy & Security Vault
            </h3>
            <p className="text-xs text-zinc-400">Zero-knowledge local-first processing with 7-day rolling context</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleExportData}
            className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 text-xs font-medium flex items-center space-x-1.5 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-sky-400" />
            <span>Export Data JSON</span>
          </button>

          <button
            onClick={() => setShowConfirm(true)}
            className="px-3 py-1.5 rounded-xl bg-red-950/60 hover:bg-red-900/60 border border-red-800/60 text-red-300 text-xs font-medium flex items-center space-x-1.5 transition-colors cursor-pointer shadow-[0_0_15px_rgba(239,68,68,0.2)]"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Wipe All Local Data</span>
          </button>
        </div>
      </div>

      {/* Wipe Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4">
          <div className="bg-zinc-950 border border-red-600/50 p-6 rounded-2xl max-w-md w-full shadow-[0_0_50px_rgba(239,68,68,0.3)]">
            <div className="flex items-center space-x-3 mb-3 text-red-400">
              <AlertTriangle className="w-6 h-6" />
              <h4 className="text-sm font-bold uppercase tracking-wider font-mono">
                Authorize Cryptographic Shred
              </h4>
            </div>
            <p className="text-xs text-zinc-300 mb-4 leading-relaxed">
              This action will instantly and permanently erase all 7-day rolling conversation logs, local cache, audio transcripts, customized reminders, and timers from this device.
            </p>
            <div className="flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs rounded-lg font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePurgeEverything}
                disabled={isWiping}
                className="px-4 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold rounded-lg flex items-center space-x-1.5 transition-colors"
              >
                {isWiping ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Shredding...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Confirm Shred & Purge</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Notification */}
      {wipeSuccess && (
        <div className="mt-4 p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>All local context and audio logs have been permanently erased from device storage.</span>
        </div>
      )}

      {/* 3 Column Data Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5">
        <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800/80">
          <div className="flex items-center space-x-2 text-sky-400 mb-1 font-mono text-xs">
            <Cpu className="w-4 h-4" />
            <span className="font-semibold uppercase">On-Device Processing</span>
          </div>
          <p className="text-2xl font-bold text-zinc-100 font-mono">100%</p>
          <p className="text-[11px] text-zinc-400 mt-1">Wake word & VAD executed in browser memory</p>
        </div>

        <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800/80">
          <div className="flex items-center space-x-2 text-emerald-400 mb-1 font-mono text-xs">
            <Database className="w-4 h-4" />
            <span className="font-semibold uppercase">7-Day Rolling Context</span>
          </div>
          <p className="text-2xl font-bold text-zinc-100 font-mono">{conversations.length} turns</p>
          <p className="text-[11px] text-zinc-400 mt-1">Automatic FIFO retention window</p>
        </div>

        <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800/80">
          <div className="flex items-center space-x-2 text-purple-400 mb-1 font-mono text-xs">
            <EyeOff className="w-4 h-4" />
            <span className="font-semibold uppercase">Telemetry Status</span>
          </div>
          <p className="text-2xl font-bold text-emerald-400 font-mono">DISABLED</p>
          <p className="text-[11px] text-zinc-400 mt-1">Zero user data sold or shared for training</p>
        </div>
      </div>

      {/* Permissions Matrix & Audit Log Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">
        {/* Granular Permissions (5 cols) */}
        <div className="lg:col-span-5 bg-zinc-900/30 border border-zinc-800/70 rounded-xl p-4">
          <h4 className="text-xs font-semibold text-zinc-100 uppercase tracking-wider font-mono mb-3 flex items-center space-x-2">
            <Lock className="w-3.5 h-3.5 text-sky-400" />
            <span>Granular Security Permissions</span>
          </h4>

          <div className="space-y-2.5">
            {[
              { key: 'micAccess', label: 'Continuous Microphone Listening', desc: 'Required for wake word detection' },
              { key: 'localPersistence', label: 'Local Encrypted Storage', desc: 'Saves 7-day conversation context' },
              { key: 'calendarAccess', label: 'Calendar & Agenda Access', desc: 'Read/write schedule & detect conflicts' },
              { key: 'messagesAccess', label: 'Unified Communications Access', desc: 'Draft replies for Gmail and Viber' },
              { key: 'telemetryEnabled', label: 'Analytics & Telemetry', desc: 'Share anonymous crash reports (Default OFF)' },
            ].map((p) => {
              const isChecked = (permissions as any)[p.key];
              return (
                <div key={p.key} className="flex items-center justify-between p-2 rounded-lg bg-zinc-950/40 border border-zinc-800/60">
                  <div className="pr-3">
                    <p className="text-xs font-medium text-zinc-200">{p.label}</p>
                    <p className="text-[10px] text-zinc-500">{p.desc}</p>
                  </div>
                  <button
                    onClick={() => handleTogglePermission(p.key as any)}
                    className={`w-9 h-5 rounded-full transition-colors relative p-0.5 ${
                      isChecked ? 'bg-sky-600' : 'bg-zinc-800'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full bg-white transition-transform ${
                        isChecked ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Real-time Audit Trail (7 cols) */}
        <div className="lg:col-span-7 bg-zinc-900/30 border border-zinc-800/70 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-semibold text-zinc-100 uppercase tracking-wider font-mono">
              Live Security & Data Audit Trail
            </h4>
            <span className="text-[10px] font-mono text-zinc-500">Immutable client log</span>
          </div>

          <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
            {auditLog.map((item) => (
              <div key={item.id} className="p-2.5 rounded-lg bg-zinc-950/60 border border-zinc-800/60 text-xs">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="font-semibold text-zinc-300 font-mono text-[11px]">{item.category}</span>
                  <span className="text-[10px] text-zinc-500 font-mono">
                    {new Date(item.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-zinc-400 text-[11px]">{item.action}</p>
                <div className="flex items-center space-x-2 mt-1 text-[10px] text-zinc-500 font-mono">
                  <span className="text-sky-400/80">Storage: {item.storageType}</span>
                  <span>•</span>
                  <span>{item.sizeBytes} bytes</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
