import React, { useState, useEffect } from 'react';
import { 
  Laptop, 
  Smartphone, 
  Globe, 
  ShieldCheck, 
  Lock, 
  Volume2, 
  VolumeX, 
  Bell, 
  ExternalLink, 
  Mic, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Radio, 
  Zap,
  Sliders,
  SmartphoneNfc,
  Terminal
} from 'lucide-react';
import deviceMesh, { DeviceNode } from '../client/services/deviceMesh';
import { soundEffects } from '../services/audioEffects';

interface SaaSDeviceControlCenterProps {
  onSpeak?: (text: string) => void;
}

export const SaaSDeviceControlCenter: React.FC<SaaSDeviceControlCenterProps> = ({ onSpeak }) => {
  const [nodes, setNodes] = useState<DeviceNode[]>([]);
  const [onlineDevices, setOnlineDevices] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedDevice, setSelectedDevice] = useState<DeviceNode | null>(null);
  
  // Action Modals State
  const [volumeLevel, setVolumeLevel] = useState<number>(70);
  const [notificationText, setNotificationText] = useState<string>('');
  const [launchUrl, setLaunchUrl] = useState<string>('');
  const [voiceRelayText, setVoiceRelayText] = useState<string>('');
  
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  const fetchMeshState = async () => {
    setLoading(true);
    try {
      const res = await deviceMesh.listMesh();
      if (res && res.nodes) {
        setNodes(res.nodes);
        setOnlineDevices(res.onlineDevices || []);
      }
    } catch (err) {
      console.warn('[DeviceMesh UI] Failed to list mesh:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMeshState();
    deviceMesh.registerThisDevice();
    const interval = setInterval(fetchMeshState, 5000);
    return () => clearInterval(interval);
  }, []);

  const triggerActionSuccess = (msg: string) => {
    setActionSuccessMsg(msg);
    soundEffects.playActivate();
    if (onSpeak) onSpeak(msg);
    setTimeout(() => setActionSuccessMsg(null), 3500);
  };

  const handleSendRemoteCommand = async (targetDevice: string, command: string, params: any = {}, successLabel: string) => {
    try {
      soundEffects.playBeep();
      const res = await deviceMesh.sendCommand(targetDevice, command, params);
      if (res && (res.success || res.deliveredCount > 0)) {
        triggerActionSuccess(successLabel);
      } else {
        alert(`Target device ${targetDevice} is currently offline or unreachable.`);
      }
    } catch (err: any) {
      alert(`Command error: ${err?.message || 'Failed to dispatch command'}`);
    }
  };

  const getPlatformIcon = (type: string) => {
    switch (type) {
      case 'windows_pc':
      case 'desktop_win':
      case 'desktop_mac':
        return <Laptop className="w-5 h-5 text-cyan-400" />;
      case 'android_phone':
      case 'ios_device':
        return <Smartphone className="w-5 h-5 text-emerald-400" />;
      default:
        return <Globe className="w-5 h-5 text-purple-400" />;
    }
  };

  return (
    <div className="space-y-6 text-slate-100 font-sans">
      {/* SaaS Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/80 to-slate-900 border border-indigo-500/20 p-6 shadow-2xl">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <Radio className="w-48 h-48 text-cyan-400 animate-pulse" />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider bg-cyan-500/20 text-cyan-300 rounded-full border border-cyan-500/30">
                SaaS Multi-Device Control Engine
              </span>
              <span className="flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-medium text-emerald-400 bg-emerald-500/10 rounded-full border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                Live Relay Active
              </span>
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight">Cross-Device Mesh Dashboard</h2>
            <p className="text-sm text-slate-400 mt-1 max-w-xl">
              Control any device signed into your email account. Adjust volume, send push alerts, launch URLs, or lock screens remotely in real-time.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchMeshState}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-300 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 rounded-xl transition-all shadow-lg active:scale-95"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
              Refresh Mesh Nodes
            </button>
          </div>
        </div>
      </div>

      {/* Success Alert Toast */}
      {actionSuccessMsg && (
        <div className="flex items-center justify-between p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 text-sm font-medium animate-in fade-in slide-in-from-top duration-300">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <span>{actionSuccessMsg}</span>
          </div>
          <Zap className="w-4 h-4 text-emerald-400 animate-bounce" />
        </div>
      )}

      {/* Grid of Registered SaaS Devices */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {nodes.length === 0 && !loading && (
          <div className="col-span-full p-12 text-center bg-slate-900/40 border border-slate-800 rounded-2xl">
            <Radio className="w-12 h-12 text-slate-600 mx-auto mb-3 animate-pulse" />
            <h3 className="text-lg font-semibold text-slate-300">No Remote Devices Registered Yet</h3>
            <p className="text-sm text-slate-500 mt-1">
              Log into Project Ahri on another device (Windows PC or phone) using your account email to link it to your mesh network.
            </p>
          </div>
        )}

        {nodes.map((node) => {
          const isOnline = onlineDevices.includes(node.device_name) || node.isOnline;
          return (
            <div
              key={node.id || node.device_name}
              className={`group relative overflow-hidden rounded-2xl bg-slate-900/80 border transition-all duration-300 p-5 ${
                isOnline 
                  ? 'border-cyan-500/30 shadow-lg shadow-cyan-950/20 hover:border-cyan-500/50' 
                  : 'border-slate-800/80 opacity-70 hover:opacity-100'
              }`}
            >
              {/* Top Row: Icon, Name & Status */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-slate-800/80 border border-slate-700/60 rounded-xl group-hover:scale-105 transition-transform">
                    {getPlatformIcon(node.device_type)}
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-slate-100 tracking-wide">{node.device_name}</h4>
                    <span className="text-xs text-slate-400 capitalize">{node.platform || node.device_type}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`w-2.5 h-2.5 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400' : 'bg-slate-600'}`} />
                  <span className={`text-xs font-semibold uppercase tracking-wider ${isOnline ? 'text-emerald-400' : 'text-slate-500'}`}>
                    {isOnline ? 'Online' : 'Offline'}
                  </span>
                </div>
              </div>

              {/* Capability Badges */}
              <div className="flex flex-wrap gap-1.5 mb-5">
                {(node.capabilities || ['volume_control', 'show_notification', 'open_url']).map((cap) => (
                  <span key={cap} className="px-2 py-0.5 text-[10px] font-medium bg-slate-800/60 text-slate-400 border border-slate-700/40 rounded-md">
                    {cap.replace('_', ' ')}
                  </span>
                ))}
              </div>

              {/* Interactive SaaS Remote Action Control Buttons */}
              <div className="pt-4 border-t border-slate-800/80 grid grid-cols-2 gap-2">
                {/* 1. Mute / Lock */}
                <button
                  disabled={!isOnline}
                  onClick={() => handleSendRemoteCommand(node.device_name, 'mute', {}, `Muted audio on ${node.device_name}`)}
                  className="flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-slate-300 bg-slate-800/80 hover:bg-slate-700 hover:text-white border border-slate-700/60 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95"
                >
                  <VolumeX className="w-3.5 h-3.5 text-amber-400" />
                  Mute Remote
                </button>

                <button
                  disabled={!isOnline}
                  onClick={() => handleSendRemoteCommand(node.device_name, 'lock', {}, `Screen lock command sent to ${node.device_name}`)}
                  className="flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-slate-300 bg-slate-800/80 hover:bg-slate-700 hover:text-white border border-slate-700/60 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95"
                >
                  <Lock className="w-3.5 h-3.5 text-rose-400" />
                  Lock Screen
                </button>

                {/* 2. Volume & Notification */}
                <button
                  disabled={!isOnline}
                  onClick={() => setSelectedDevice(node)}
                  className="col-span-2 flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-semibold text-cyan-300 bg-cyan-950/40 hover:bg-cyan-900/60 border border-cyan-500/30 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-md active:scale-95"
                >
                  <Sliders className="w-4 h-4 text-cyan-400" />
                  Remote Control Panel & Actions
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Device Remote Action Drawer Modal */}
      {selectedDevice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-slate-900 border border-cyan-500/30 shadow-2xl p-6 space-y-6">
            <div className="flex items-start justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-xl">
                  {getPlatformIcon(selectedDevice.device_type)}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">{selectedDevice.device_name}</h3>
                  <span className="text-xs text-cyan-400 font-mono">SaaS Remote Control Console</span>
                </div>
              </div>
              <button
                onClick={() => setSelectedDevice(null)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 rounded-lg transition-colors"
              >
                Close
              </button>
            </div>

            {/* Remote Actions Stack */}
            <div className="space-y-5">
              {/* Action A: Remote Volume Control */}
              <div className="p-4 bg-slate-800/40 border border-slate-800 rounded-xl space-y-3">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                  <span className="flex items-center gap-2">
                    <Volume2 className="w-4 h-4 text-cyan-400" />
                    Remote Volume Adjustment
                  </span>
                  <span className="text-cyan-400 font-mono">{volumeLevel}%</span>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={volumeLevel}
                    onChange={(e) => setVolumeLevel(Number(e.target.value))}
                    className="w-full accent-cyan-400 bg-slate-700 h-2 rounded-lg cursor-pointer"
                  />
                  <button
                    onClick={() => handleSendRemoteCommand(selectedDevice.device_name, 'set_volume', { level: volumeLevel }, `Volume set to ${volumeLevel}% on ${selectedDevice.device_name}`)}
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-500 rounded-lg transition-colors shadow-md shrink-0"
                  >
                    Apply
                  </button>
                </div>
              </div>

              {/* Action B: Push Notification Alert */}
              <div className="p-4 bg-slate-800/40 border border-slate-800 rounded-xl space-y-3">
                <label className="block text-xs font-semibold text-slate-300 flex items-center gap-2">
                  <Bell className="w-4 h-4 text-amber-400" />
                  Send Remote Toast Notification
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="e.g. Meeting starting in 5 minutes..."
                    value={notificationText}
                    onChange={(e) => setNotificationText(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700/80 rounded-lg text-slate-100 focus:outline-none focus:border-cyan-500"
                  />
                  <button
                    disabled={!notificationText.trim()}
                    onClick={() => {
                      handleSendRemoteCommand(selectedDevice.device_name, 'show_notification', { title: 'Project Ahri Mesh Alert', body: notificationText }, `Alert sent to ${selectedDevice.device_name}`);
                      setNotificationText('');
                    }}
                    className="px-3 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg disabled:opacity-40 transition-colors shrink-0"
                  >
                    Send
                  </button>
                </div>
              </div>

              {/* Action C: Open Remote URL */}
              <div className="p-4 bg-slate-800/40 border border-slate-800 rounded-xl space-y-3">
                <label className="block text-xs font-semibold text-slate-300 flex items-center gap-2">
                  <ExternalLink className="w-4 h-4 text-purple-400" />
                  Remote Web Link Launcher
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="https://..."
                    value={launchUrl}
                    onChange={(e) => setLaunchUrl(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700/80 rounded-lg text-slate-100 focus:outline-none focus:border-cyan-500"
                  />
                  <button
                    disabled={!launchUrl.trim()}
                    onClick={() => {
                      handleSendRemoteCommand(selectedDevice.device_name, 'open_url', { url: launchUrl }, `Launched URL on ${selectedDevice.device_name}`);
                      setLaunchUrl('');
                    }}
                    className="px-3 py-2 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 rounded-lg disabled:opacity-40 transition-colors shrink-0"
                  >
                    Open
                  </button>
                </div>
              </div>

              {/* Action D: Remote Voice Relay */}
              <div className="p-4 bg-slate-800/40 border border-slate-800 rounded-xl space-y-3">
                <label className="block text-xs font-semibold text-slate-300 flex items-center gap-2">
                  <Mic className="w-4 h-4 text-emerald-400" />
                  Remote Ahri Voice Relay Execution
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="e.g. Schedule sync at 3pm..."
                    value={voiceRelayText}
                    onChange={(e) => setVoiceRelayText(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700/80 rounded-lg text-slate-100 focus:outline-none focus:border-cyan-500"
                  />
                  <button
                    disabled={!voiceRelayText.trim()}
                    onClick={() => {
                      handleSendRemoteCommand(selectedDevice.device_name, 'voice_relay', { message: voiceRelayText }, `Dispatched command to Ahri on ${selectedDevice.device_name}`);
                      setVoiceRelayText('');
                    }}
                    className="px-3 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg disabled:opacity-40 transition-colors shrink-0"
                  >
                    Relay
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SaaSDeviceControlCenter;
