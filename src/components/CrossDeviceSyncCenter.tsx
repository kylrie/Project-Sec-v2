import React, { useState, useEffect } from 'react';
import { 
  Laptop, 
  Smartphone, 
  Glasses, 
  ShieldCheck, 
  Lock, 
  Key, 
  Globe, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Download, 
  Fingerprint, 
  Activity, 
  Layers,
  ArrowRight,
  Server,
  FileSpreadsheet
} from 'lucide-react';
import { CrossDeviceSyncState, DataResidencyRegion, SyncedDevice, AuditLogEntry } from '../types/friday';
import { cloudSyncService } from '../services/cloudSyncService';
import { securityVaultService } from '../services/securityVaultService';
import { storageService } from '../services/storage';
import { SoundSynthesizer } from '../services/audioEffects';

interface CrossDeviceSyncCenterProps {
  soundSynth?: SoundSynthesizer;
  onSpeak?: (text: string) => void;
}

export const CrossDeviceSyncCenter: React.FC<CrossDeviceSyncCenterProps> = ({
  soundSynth,
  onSpeak
}) => {
  const [syncState, setSyncState] = useState<CrossDeviceSyncState>(cloudSyncService.getState());
  const [auditSummary, setAuditSummary] = useState(securityVaultService.getDailyAuditSummary());
  const [isBiometricAuthenticating, setIsBiometricAuthenticating] = useState(false);
  const [biometricSuccess, setBiometricSuccess] = useState(false);
  const [isSyncingNow, setIsSyncingNow] = useState(false);

  useEffect(() => {
    const unsub = cloudSyncService.subscribe((state) => {
      setSyncState(state);
    });
    return unsub;
  }, []);

  const handleManualSync = async () => {
    soundSynth?.playBeep();
    setIsSyncingNow(true);
    await cloudSyncService.pushChange('MANUAL_SYNC', { timestamp: Date.now() });
    setTimeout(() => {
      setIsSyncingNow(false);
      soundSynth?.playActivate();
      setAuditSummary(securityVaultService.getDailyAuditSummary());
    }, 800);
  };

  const handleConflictResolve = (mode: 'auto_merge' | 'server_authoritative' | 'client_first') => {
    soundSynth?.playActivate();
    cloudSyncService.resolveConflictIntelligently(mode);
  };

  const handleDataResidencyChange = (region: DataResidencyRegion) => {
    soundSynth?.playBeep();
    cloudSyncService.setDataResidency(region);
  };

  const handleBiometricTest = async () => {
    soundSynth?.playBeep();
    setIsBiometricAuthenticating(true);
    setBiometricSuccess(false);

    const result = await securityVaultService.requestBiometricAuth('Review & Export Daily Audit Logs');
    setIsBiometricAuthenticating(false);
    if (result.success) {
      soundSynth?.playActivate();
      setBiometricSuccess(true);
      setAuditSummary(securityVaultService.getDailyAuditSummary());
      if (onSpeak) onSpeak("Biometric authentication verified via Secure Enclave.");
    }
  };

  const handleExportComplianceArchive = () => {
    soundSynth?.playActivate();
    const data = securityVaultService.exportSecurityArchive();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `FRIDAY_E2EE_Audit_Archive_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getDeviceIcon = (type: SyncedDevice['deviceType']) => {
    switch (type) {
      case 'desktop_mac':
      case 'desktop_win':
        return <Laptop className="w-5 h-5 text-cyan-400" />;
      case 'mobile_ios':
      case 'mobile_android':
        return <Smartphone className="w-5 h-5 text-emerald-400" />;
      case 'web':
        return <Glasses className="w-5 h-5 text-purple-400" />;
      default:
        return <Laptop className="w-5 h-5 text-cyan-400" />;
    }
  };

  return (
    <div id="cross-device-sync-center" className="space-y-6 animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="p-6 rounded-2xl bg-slate-900/80 border border-cyan-500/30 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-cyan-500/20 border border-cyan-400/30 text-cyan-400">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-white">Cross-Device E2EE Synchronization</h2>
              <span className="px-2 py-0.5 text-xs font-bold rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                {syncState.syncStatus === 'synced' ? 'All Devices Synced' : syncState.syncStatus}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              WebSocket real-time mesh with AES-GCM 256-bit client-held keys & automated vector conflict resolution
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="btn-force-sync"
            onClick={handleManualSync}
            disabled={isSyncingNow}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-cyan-500/25 transition-all cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncingNow ? 'animate-spin' : ''}`} />
            Sync Mesh Now
          </button>
        </div>
      </div>

      {/* Grid: Connected Devices & Encryption Keys */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Paired Devices Mesh (2 Cols) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-cyan-400" />
                Active Synchronized Mesh Nodes ({syncState.connectedDevices.length})
              </h3>
              <span className="text-xs text-slate-400 font-mono">
                WebSocket Ping: 18ms
              </span>
            </div>

            <div className="space-y-3">
              {syncState.connectedDevices.map((device) => (
                <div
                  key={device.deviceId}
                  className={`p-4 rounded-xl border flex items-center justify-between transition-all ${
                    device.isCurrentDevice
                      ? 'bg-slate-950/80 border-cyan-500/40 shadow-md shadow-cyan-500/10'
                      : 'bg-slate-950/40 border-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                      {getDeviceIcon(device.deviceType)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-white">{device.deviceName}</span>
                        {device.isCurrentDevice && (
                          <span className="px-1.5 py-0.2 text-[10px] font-bold rounded bg-cyan-500/20 text-cyan-400 border border-cyan-500/40">
                            Current Node
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                        <span>{device.appVersion}</span>
                        <span>•</span>
                        <span>{device.ipLocation}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="flex items-center gap-1 text-emerald-400 text-xs font-semibold">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      Live Connected
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      Last sync: {Math.round((Date.now() - device.lastSyncedAt) / 1000)}s ago
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Intelligent Conflict Resolution Controller */}
            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 mt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-200">
                  Simultaneous Edit Conflict Resolution Strategy:
                </span>
                <span className="text-[11px] text-cyan-400 font-mono uppercase">
                  {syncState.conflictResolutionMode}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <button
                  onClick={() => handleConflictResolve('auto_merge')}
                  className={`p-2 rounded-lg border text-center font-medium transition-all ${
                    syncState.conflictResolutionMode === 'auto_merge'
                      ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300'
                      : 'border-slate-800 text-slate-400 hover:bg-slate-900'
                  }`}
                >
                  Intelligent Merge (3-Way)
                </button>
                <button
                  onClick={() => handleConflictResolve('client_first')}
                  className={`p-2 rounded-lg border text-center font-medium transition-all ${
                    syncState.conflictResolutionMode === 'client_first'
                      ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300'
                      : 'border-slate-800 text-slate-400 hover:bg-slate-900'
                  }`}
                >
                  Local Device Priority
                </button>
                <button
                  onClick={() => handleConflictResolve('server_authoritative')}
                  className={`p-2 rounded-lg border text-center font-medium transition-all ${
                    syncState.conflictResolutionMode === 'server_authoritative'
                      ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300'
                      : 'border-slate-800 text-slate-400 hover:bg-slate-900'
                  }`}
                >
                  Cloud Timestamp Priority
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Security & Residency Controller */}
        <div className="space-y-4">
          {/* E2EE Key Card */}
          <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Key className="w-4 h-4 text-amber-400" />
              End-to-End Encryption Keys
            </h3>

            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2 text-xs">
              <div className="flex items-center justify-between text-slate-400">
                <span>Encryption Cipher:</span>
                <span className="font-mono text-cyan-400 font-bold">AES-GCM 256-bit</span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>Key Storage:</span>
                <span className="text-emerald-400 font-semibold">User Secure Enclave</span>
              </div>
              <div className="text-[11px] text-slate-400">
                <span>Key Fingerprint:</span>
                <div className="p-1.5 mt-1 rounded bg-slate-900 font-mono text-[10px] text-amber-300 truncate">
                  {syncState.e2eeKeyFingerprint}
                </div>
              </div>
            </div>

            {/* Data Residency Selector */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-white flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-cyan-400" />
                Data Residency Region:
              </label>
              <div className="grid grid-cols-3 gap-2 text-xs">
                {(['us-east', 'eu-central', 'asia-east'] as DataResidencyRegion[]).map((region) => (
                  <button
                    key={region}
                    onClick={() => handleDataResidencyChange(region)}
                    className={`p-2 rounded-lg border text-center font-bold uppercase text-[11px] transition-all ${
                      syncState.dataResidency === region
                        ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                        : 'border-slate-800 text-slate-400 hover:bg-slate-850'
                    }`}
                  >
                    {region === 'eu-central' ? 'EU (Frankfurt)' : region === 'us-east' ? 'US (Virginia)' : 'Asia (Tokyo)'}
                  </button>
                ))}
              </div>
            </div>

            {/* Biometric Verification Simulation */}
            <div className="pt-3 border-t border-slate-800 space-y-2">
              <button
                onClick={handleBiometricTest}
                disabled={isBiometricAuthenticating}
                className="w-full py-2.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/40 text-purple-300 font-bold text-xs flex items-center justify-center gap-2 transition-all"
              >
                <Fingerprint className="w-4 h-4" />
                {isBiometricAuthenticating ? 'Scanning Biometrics...' : 'Authenticate Biometric Lock'}
              </button>
              {biometricSuccess && (
                <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Biometric authorization verified for sensitive actions.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom: Daily Executive Audit Log */}
      <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-cyan-400" />
              Daily Executive Audit Log
            </h3>
            <p className="text-xs text-slate-400">
              Complete transparent disclosure of all autonomous emails, calendar events, and screened communications.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                soundSynth?.playActivate();
                if (onSpeak) onSpeak(auditSummary.vocalPrompt);
              }}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-all"
            >
              Speak Audit Summary
            </button>
            <button
              onClick={handleExportComplianceArchive}
              className="px-3 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 border border-cyan-500/30 text-xs font-bold flex items-center gap-1.5 transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              Export GDPR Archive
            </button>
          </div>
        </div>

        {/* Audit Highlights */}
        <div className="p-3.5 rounded-xl bg-slate-950/70 border border-cyan-500/20 text-xs text-cyan-200 italic">
          "{auditSummary.vocalPrompt}"
        </div>

        {/* Audit Table */}
        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
          {auditSummary.logs.map((log) => (
            <div
              key={log.id}
              className="p-3 rounded-lg bg-slate-950/50 border border-slate-850 flex items-center justify-between text-xs gap-3"
            >
              <div className="flex items-center gap-3">
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                  log.actionType === 'email_sent' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                  log.actionType === 'event_created' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' :
                  log.actionType === 'biometric_auth' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' :
                  'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                }`}>
                  {log.actionType.replace('_', ' ')}
                </span>
                <span className="text-slate-300">{log.description}</span>
              </div>

              <div className="flex items-center gap-3 shrink-0 text-slate-400 text-[11px]">
                {log.biometricVerified && (
                  <span className="text-emerald-400 flex items-center gap-1 font-semibold">
                    <Fingerprint className="w-3 h-3" /> Biometric
                  </span>
                )}
                <span>{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
