import { websocketService } from './websocketService';
import { apiPost, apiGet } from './apiClient';

export interface DeviceCommand {
  type: 'DEVICE_COMMAND' | 'DEVICE_BROADCAST';
  command: string;
  params?: any;
  targetDevice?: string;
  timestamp?: number;
}

export interface DeviceNode {
  id: string;
  user_id: string;
  device_name: string;
  device_type: 'windows_pc' | 'android_phone' | 'android_tablet' | 'smart_hub' | 'smart_light' | 'smart_speaker' | 'security_cam' | 'iot_sensor';
  platform: string;
  local_ip?: string;
  ws_connected: boolean;
  isOnline?: boolean;
  capabilities: string[];
  last_seen: string;
  metadata?: any;
}

class DeviceMeshController {
  private handlers = new Map<string, (params: any) => void>();
  private currentDeviceName: string = 'web_client';

  constructor() {
    // Detect environment
    if (typeof window !== 'undefined') {
      if ((window as any).electronAPI) {
        this.currentDeviceName = 'windows_pc';
      } else if (/Android/i.test(navigator.userAgent)) {
        this.currentDeviceName = 'android_phone';
      } else if (/iPhone|iPad/i.test(navigator.userAgent)) {
        this.currentDeviceName = 'ios_device';
      } else {
        this.currentDeviceName = 'browser_station';
      }
    }

    // Subscribe to WebSocket commands
    websocketService.connect((msg: any) => {
      if (msg && (msg.type === 'DEVICE_COMMAND' || msg.type === 'DEVICE_BROADCAST')) {
        this.executeCommand(msg);
      }
    });

    this.setupDefaultHandlers();
  }

  public registerHandler(command: string, handler: (params: any) => void) {
    this.handlers.set(command, handler);
  }

  private executeCommand(cmd: DeviceCommand) {
    console.log(`[DeviceMesh] Incoming command: '${cmd.command}'`, cmd.params);
    const handler = this.handlers.get(cmd.command);
    if (handler) {
      try {
        handler(cmd.params || {});
      } catch (err) {
        console.error(`[DeviceMesh] Error executing handler for '${cmd.command}':`, err);
      }
    } else {
      console.warn(`[DeviceMesh] No local handler registered for command: ${cmd.command}`);
    }
  }

  public setupDefaultHandlers() {
    // 1. System Shutdown / Lock
    this.registerHandler('shutdown', () => {
      if ((window as any).electronAPI?.shutdown) {
        (window as any).electronAPI.shutdown();
      } else {
        console.log('[DeviceMesh] Shutdown command received on non-Electron target');
      }
    });

    this.registerHandler('lock', () => {
      if ((window as any).electronAPI?.lock) {
        (window as any).electronAPI.lock();
      }
    });

    // 2. Volume & Audio Control
    this.registerHandler('set_volume', (params: { level: number }) => {
      const level = params?.level ?? 50;
      if ((window as any).electronAPI?.setVolume) {
        (window as any).electronAPI.setVolume(level);
      }
      // Browser audio adjustment
      const mediaElements = document.querySelectorAll('audio, video');
      mediaElements.forEach((el) => {
        (el as HTMLMediaElement).volume = Math.max(0, Math.min(1, level / 100));
      });
    });

    this.registerHandler('mute', () => {
      if ((window as any).electronAPI?.mute) {
        (window as any).electronAPI.mute();
      }
      const mediaElements = document.querySelectorAll('audio, video');
      mediaElements.forEach((el) => {
        (el as HTMLMediaElement).muted = true;
      });
    });

    // 3. Open URL
    this.registerHandler('open_url', (params: { url: string }) => {
      if (params?.url) {
        window.open(params.url, '_blank');
      }
    });

    // 4. Notifications
    this.registerHandler('show_notification', (params: { title: string; body: string }) => {
      const title = params?.title || 'Project Ahri Mesh Alert';
      const body = params?.body || 'Cross-device command received';
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, { body, icon: '/favicon.ico' });
      }
    });

    // 5. Vibration / Haptic (Mobile)
    this.registerHandler('vibrate', (params: { pattern?: number[] }) => {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(params?.pattern || [200, 100, 200]);
      }
    });

    // 6. Voice Relay Command (Remote execution on Ahri AI engine)
    this.registerHandler('voice_relay', async (params: { message: string }) => {
      if (params?.message) {
        console.log(`[DeviceMesh] Remote Voice Relay received: "${params.message}"`);
        try {
          await apiPost('/api/command', {
            message: params.message,
            sessionId: 'remote-mesh-relay',
            personality: 'professional',
            userTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          });
        } catch (err) {
          console.error('[DeviceMesh] Voice relay error:', err);
        }
      }
    });
  }

  /**
   * Send a command to another device or all devices in the mesh
   */
  public async sendCommand(targetDevice: string, command: string, params: any = {}) {
    return apiPost('/api/devices/command', {
      targetDevice,
      command,
      params
    });
  }

  /**
   * Register this device in the neural mesh
   */
  public async registerThisDevice(options: {
    deviceName?: string;
    deviceType?: string;
    capabilities?: string[];
  } = {}) {
    const name = options.deviceName || this.currentDeviceName;
    const type = options.deviceType || (this.currentDeviceName === 'windows_pc' ? 'windows_pc' : 'android_phone');
    const capabilities = options.capabilities || ['volume_control', 'open_url', 'show_notification'];

    // Send via WebSocket register
    websocketService.send({
      type: 'REGISTER_DEVICE',
      deviceName: name
    });

    // Register with backend database
    return apiPost('/api/devices/register', {
      deviceName: name,
      deviceType: type,
      platform: navigator.platform || 'web',
      capabilities
    });
  }

  /**
   * List all devices in user's mesh
   */
  public async listMesh(): Promise<{ nodes: DeviceNode[]; onlineDevices: string[] }> {
    return apiGet('/api/devices/mesh');
  }
}

export const deviceMesh = new DeviceMeshController();
export default deviceMesh;
