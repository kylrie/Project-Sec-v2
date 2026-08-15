import { Router } from 'express';
import { getSupabaseAdmin, isSupabaseConfigured } from '../db/supabaseClient.js';
import { dbRepository as sqliteDbRepository } from '../db/database.js';
import { authMiddleware, AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { broadcastToDevice, broadcastToAllDevices, getConnectedDevices } from '../services/meshService.js';

const router = Router();

// Register a device node
router.post('/register', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { deviceName, deviceType = 'windows_pc', platform = 'windows', localIp, capabilities = [] } = req.body;
    const userId = req.user?.uid || 'dev-user-001';

    if (!deviceName) {
      return res.status(400).json({ error: 'deviceName is required' });
    }

    if (isSupabaseConfigured()) {
      try {
        const db = getSupabaseAdmin();
        const { data, error } = await db
          .from('device_nodes')
          .upsert({
            user_id: userId,
            device_name: deviceName,
            device_type: deviceType,
            platform,
            local_ip: localIp,
            capabilities,
            ws_connected: true,
            last_seen: new Date().toISOString()
          }, { onConflict: 'user_id, device_name' })
          .select()
          .single();

        if (!error && data) {
          return res.json({ success: true, node: data });
        }
      } catch (e: any) {
        console.warn('[DeviceMesh] Supabase register fallback to SQLite:', e.message);
      }
    }

    // Local SQLite fallback
    const node = sqliteDbRepository.upsertDeviceNode(userId, {
      deviceName,
      deviceType,
      platform,
      localIp,
      capabilities
    });

    res.json({ success: true, node });
  } catch (err: any) {
    console.error('[DeviceMesh] Register exception:', err);
    res.status(500).json({ error: err.message || 'Failed to register device' });
  }
});

// List user's device mesh
router.get('/mesh', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.uid || 'dev-user-001';
    const liveDevices = getConnectedDevices(userId);

    if (isSupabaseConfigured()) {
      try {
        const db = getSupabaseAdmin();
        const { data, error } = await db
          .from('device_nodes')
          .select('*')
          .eq('user_id', userId)
          .order('last_seen', { ascending: false });

        if (!error && data) {
          const augmented = data.map((d: any) => ({
            ...d,
            isOnline: liveDevices.includes(d.device_name) || d.ws_connected
          }));
          return res.json({ nodes: augmented, onlineDevices: liveDevices });
        }
      } catch (e: any) {
        console.warn('[DeviceMesh] Supabase mesh fallback to SQLite:', e.message);
      }
    }

    const sqliteNodes = sqliteDbRepository.listDeviceNodes(userId);
    const augmented = sqliteNodes.map((d: any) => ({
      ...d,
      isOnline: liveDevices.includes(d.device_name) || d.ws_connected
    }));

    res.json({ nodes: augmented, onlineDevices: liveDevices });
  } catch (err: any) {
    console.error('[DeviceMesh] List mesh exception:', err);
    res.status(500).json({ error: err.message || 'Failed to list mesh' });
  }
});

// Send command to a device in the mesh
router.post('/command', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { targetDevice, command, params = {} } = req.body;
    const userId = req.user?.uid || 'dev-user-001';

    if (!command) {
      return res.status(400).json({ error: 'command is required' });
    }

    let success = false;
    if (targetDevice === '*' || targetDevice === 'all') {
      const count = broadcastToAllDevices(userId, { command, params });
      success = count > 0;
      return res.json({ success, deliveredCount: count, message: `Command broadcasted to ${count} devices` });
    } else {
      success = broadcastToDevice(userId, targetDevice, { command, params });
      return res.json({
        success,
        targetDevice,
        message: success ? `Command sent to ${targetDevice}` : `Target device ${targetDevice} is currently offline or unreachable`
      });
    }
  } catch (err: any) {
    console.error('[DeviceMesh] Command exception:', err);
    res.status(500).json({ error: err.message || 'Failed to dispatch device command' });
  }
});

export { router as deviceRouter };
