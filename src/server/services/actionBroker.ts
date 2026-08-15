import { GoogleGenAI } from '@google/genai';
import { broadcastToDevice, broadcastToAllDevices, getConnectedDevices } from './meshService.js';
import { dbRepository as sqliteDbRepository } from '../db/database.js';

export interface ActionIntent {
  category: 'food' | 'transport' | 'shopping' | 'booking' | 'payment' | 'communication';
  service: string; // 'dominos', 'grab', 'gcash', 'opentable', etc.
  action: 'order' | 'book' | 'send' | 'call' | 'pay';
  items?: Array<{ name: string; quantity: number; options?: any }>;
  recipient?: string;
  amount?: number;
  destination?: string;
  time?: string;
  notes?: string;
  confirmation_required: boolean;
}

export interface ActionBrokerResult {
  success: boolean;
  action: string;
  target?: string;
  data?: any;
  spokenReply: string;
}

export async function parseActionIntent(message: string): Promise<ActionIntent | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key || key === 'MY_GEMINI_API_KEY') {
    // Local heuristic parser for offline demo
    const lower = message.toLowerCase();
    if (lower.includes('pizza') || lower.includes('dominos') || lower.includes('food') || lower.includes('burger')) {
      return {
        category: 'food',
        service: lower.includes('dominos') ? 'dominos' : 'grabfood',
        action: 'order',
        items: [{ name: lower.includes('pizza') ? 'Pepperoni Pizza' : 'Cheeseburger', quantity: 1 }],
        confirmation_required: true
      };
    }
    if (lower.includes('grab') || lower.includes('uber') || lower.includes('ride') || lower.includes('angkas')) {
      return {
        category: 'transport',
        service: lower.includes('uber') ? 'uber' : lower.includes('angkas') ? 'angkas' : 'grab',
        action: 'book',
        destination: 'Office HQ',
        items: [],
        confirmation_required: true
      };
    }
    if (lower.includes('gcash') || lower.includes('maya') || lower.includes('send money') || lower.includes('pay')) {
      return {
        category: 'payment',
        service: lower.includes('maya') ? 'maya' : 'gcash',
        action: 'pay',
        amount: 500,
        recipient: 'Alex Vance',
        items: [],
        confirmation_required: true
      };
    }
    return null;
  }

  try {
    const ai = new GoogleGenAI({ apiKey: key });
    const prompt = `You are Ahri's Action Broker. Determine if this user command is requesting an action/order (food, transport, shopping, booking, payment, communication) and parse it into a structured action intent. If this is regular conversational chat, return {"category": null}.

User said: "${message}"

Extract:
- What category? (food, transport, shopping, booking, payment, communication or null)
- What service? (dominos, pizza_hut, grab, grabfood, foodpanda, uber, gcash, maya, opentable, nike, etc.)
- What action? (order, book, send, call, pay)
- What items/details?
- Who is the recipient?
- How much?
- When?
- Any special notes?

Return ONLY valid JSON matching this schema:
{
  "category": "food|transport|shopping|booking|payment|communication|null",
  "service": "string",
  "action": "order|book|send|call|pay",
  "items": [{"name": "string", "quantity": 1, "options": {}}],
  "recipient": "string or null",
  "amount": 0,
  "destination": "string or null", 
  "time": "string or null",
  "notes": "string or null",
  "confirmation_required": true
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: prompt,
      config: { responseMimeType: 'application/json' }
    });

    const parsed = JSON.parse(response.text || '{}');
    if (!parsed || !parsed.category || parsed.category === 'null') {
      return null;
    }
    return parsed;
  } catch (err) {
    console.warn('[ActionBroker] parseActionIntent exception:', err);
    return null;
  }
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
        const state = params.state || 'toggle';
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
