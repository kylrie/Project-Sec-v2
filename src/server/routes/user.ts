import { Router, Response } from 'express';
import { authMiddleware, AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { dbRepository } from '../db/supabaseClient.js';
import { notificationService } from '../services/notificationService.js';

export const userRouter = Router();

// Apply auth middleware
userRouter.use(authMiddleware);

// GET /api/user/profile - Fetch executive profile
userRouter.get('/profile', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.uid;
    const profile = await dbRepository.getUserProfile(userId);
    res.json(profile || { id: userId, email: req.user!.email, wake_word: 'Hey Ahri', personality: 'professional' });
  } catch (error: any) {
    console.error('GET /api/user/profile error:', error);
    res.status(500).json({ error: 'Failed to retrieve profile', details: error.message });
  }
});

// PUT /api/user/profile - Update executive preferences
userRouter.put('/profile', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.uid;
    const updated = await dbRepository.updateUserProfile(userId, req.body);
    res.json(updated);
  } catch (error: any) {
    console.error('PUT /api/user/profile error:', error);
    res.status(500).json({ error: 'Failed to update profile', details: error.message });
  }
});

// GET /api/user/devices - List registered user devices
userRouter.get('/devices', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.uid;
    const devices = await dbRepository.getUserDevices(userId);
    res.json(devices);
  } catch (error: any) {
    console.error('GET /api/user/devices error:', error);
    res.status(500).json({ error: 'Failed to retrieve devices', details: error.message });
  }
});

// POST /api/user/devices - Register new device with FCM push token
userRouter.post('/devices', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.uid;
    const { deviceName, platform, pushToken } = req.body;

    if (!deviceName || !platform) {
      return res.status(400).json({ error: 'deviceName and platform (android|ios|windows|macos|web) are required' });
    }

    const device = await dbRepository.registerDevice(userId, deviceName, platform, pushToken);
    res.status(201).json(device);
  } catch (error: any) {
    console.error('POST /api/user/devices error:', error);
    res.status(500).json({ error: 'Failed to register device', details: error.message });
  }
});

// POST /api/user/test-push - Send a test push notification
userRouter.post('/test-push', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.uid;
    const { title = "✦ Project Ahri Neural Alert", body = "Live push notification channel operational across your devices." } = req.body;

    const result = await notificationService.sendPushNotification(userId, title, body, { type: "test_alert" });
    res.json(result);
  } catch (error: any) {
    console.error('POST /api/user/test-push error:', error);
    res.status(500).json({ error: 'Failed to dispatch test push', details: error.message });
  }
});
