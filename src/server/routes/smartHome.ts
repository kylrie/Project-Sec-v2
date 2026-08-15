import { Router } from 'express';
import { authMiddleware, AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { controlKasaDevice, controlHueLight, discoverLocalSmartDevices } from '../services/smartHomeBridge.js';

const router = Router();

// POST /api/smarthome/kasa
router.post('/kasa', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { ip, command = 'on', value } = req.body;
    if (!ip) {
      return res.status(400).json({ error: 'Device IP is required' });
    }

    const result = await controlKasaDevice(ip, command, value);
    res.json(result);
  } catch (err: any) {
    console.error('[SmartHomeRouter] Kasa control error:', err);
    res.status(500).json({ error: err.message || 'Failed to control Kasa device' });
  }
});

// POST /api/smarthome/hue
router.post('/hue', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { bridgeIp, lightId = '1', state = { on: true } } = req.body;
    if (!bridgeIp) {
      return res.status(400).json({ error: 'Hue Bridge IP is required' });
    }

    const result = await controlHueLight(bridgeIp, lightId, state);
    res.json(result);
  } catch (err: any) {
    console.error('[SmartHomeRouter] Hue control error:', err);
    res.status(500).json({ error: err.message || 'Failed to control Hue light' });
  }
});

// GET /api/smarthome/discover
router.get('/discover', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const devices = await discoverLocalSmartDevices();
    res.json({ devices, count: devices.length });
  } catch (err: any) {
    console.error('[SmartHomeRouter] Discovery error:', err);
    res.status(500).json({ error: err.message || 'Failed to discover smart devices' });
  }
});

export { router as smartHomeRouter };
