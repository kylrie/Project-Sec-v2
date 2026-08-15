import { broadcastToDevice, broadcastToAllDevices, getConnectedDevices } from './meshService.js';
import { dbRepository as sqliteDbRepository } from '../db/database.js';

export interface ActionBrokerResult {
  success: boolean;
  action: string;
  target?: string;
  data?: any;
  spokenReply: string;
}

export class VoiceActionBroker {
  /**
   * Central dispatch hub for executing actions initiated by Voice Commands, AI Brain Tools, or Proactive Suggestions
   */
  public async dispatchAction(userId: string, actionName: string, params: any = {}): Promise<ActionBrokerResult> {
    console.log(`[ActionBroker] Dispatching action: '${actionName}' for user '${userId}' with params:`, params);

    switch (actionName) {
      // 1. Cross-Device Mesh Controls
      case 'mesh_send_device_command':
      case 'device_command': {
        const targetDevice = params.targetDevice || params.device || 'all';
        const command = params.command || params.action || 'ping';
        const commandParams = params.params || params.payload || {};

        if (targetDevice === '*' || targetDevice.toLowerCase() === 'all') {
          const sentCount = broadcastToAllDevices(userId, { command, params: commandParams });
          return {
            success: sentCount > 0,
            action: actionName,
            target: 'all',
            data: { sentCount },
            spokenReply: sentCount > 0
              ? `Command ${command} broadcasted across ${sentCount} connected devices.`
              : `Command queued, but no active mesh devices are currently online.`
          };
        } else {
          const sent = broadcastToDevice(userId, targetDevice, { command, params: commandParams });
          return {
            success: sent,
            action: actionName,
            target: targetDevice,
            spokenReply: sent
              ? `Transmitted ${command} command to ${targetDevice}.`
              : `Unable to reach ${targetDevice}. The device appears to be offline.`
          };
        }
      }

      case 'mesh_list_devices': {
        const liveDevices = getConnectedDevices(userId);
        const registered = sqliteDbRepository.listDeviceNodes(userId);
        return {
          success: true,
          action: actionName,
          data: { registered, liveDevices },
          spokenReply: liveDevices.length > 0
            ? `You have ${liveDevices.length} active node${liveDevices.length > 1 ? 's' : ''} online: ${liveDevices.join(', ')}.`
            : `Your device mesh is registered, but no remote nodes are connected right now.`
        };
      }

      // 2. PC & OS System Controls
      case 'system_shutdown':
      case 'system_lock':
      case 'system_volume':
      case 'system_mute': {
        const target = params.targetDevice || 'windows_pc';
        broadcastToDevice(userId, target, {
          command: actionName.replace('system_', ''),
          params
        });
        return {
          success: true,
          action: actionName,
          target,
          spokenReply: `System command executed for ${target}.`
        };
      }

      // 3. IoT & Smart Environment Controls
      case 'iot_light_control': {
        const state = params.state || 'toggle'; // 'on' | 'off' | 'dim' | 'color'
        const room = params.room || 'office';
        broadcastToAllDevices(userId, {
          command: 'light_control',
          params: { state, room, brightness: params.brightness, color: params.color }
        });
        return {
          success: true,
          action: actionName,
          spokenReply: `Setting ${room} lighting to ${state}.`
        };
      }

      // 4. Default fallback
      default: {
        return {
          success: true,
          action: actionName,
          data: params,
          spokenReply: `Action ${actionName} routed successfully.`
        };
      }
    }
  }
}

export const actionBroker = new VoiceActionBroker();
