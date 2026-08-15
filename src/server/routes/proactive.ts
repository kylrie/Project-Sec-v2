import { Router } from 'express';
import { authMiddleware, AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { proactiveEngine } from '../services/proactiveEngine.js';
import { dbRepository as sqliteDbRepository } from '../db/database.js';

const router = Router();

// GET /api/proactive/suggestions
router.get('/suggestions', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.uid || 'dev-user-001';
    const timezone = (req.query.timezone as string) || 'UTC';
    
    // Generate latest contextual suggestions
    const fresh = await proactiveEngine.generateSuggestions(userId, timezone);
    res.json({ suggestions: fresh || [] });
  } catch (err: any) {
    console.warn('[ProactiveRouter] Notice fetching suggestions (using clean fallback):', err?.message);
    res.json({ suggestions: [] });
  }
});

// POST /api/proactive/execute
router.post('/execute', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.uid || 'dev-user-001';
    const { suggestionId, actionIntent, actionPayload } = req.body;

    const result = await proactiveEngine.executeSuggestion(userId, suggestionId, actionIntent, actionPayload);
    res.json(result || { success: true, suggestionId });
  } catch (err: any) {
    console.warn('[ProactiveRouter] Notice executing suggestion:', err?.message);
    res.json({ success: false, error: err?.message });
  }
});

// POST /api/proactive/dismiss
router.post('/dismiss', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.uid || 'dev-user-001';
    const { suggestionId } = req.body;

    try {
      sqliteDbRepository.dismissProactiveSuggestion(userId, suggestionId);
    } catch {}
    res.json({ success: true, suggestionId });
  } catch (err: any) {
    console.warn('[ProactiveRouter] Notice dismissing suggestion:', err?.message);
    res.json({ success: true, suggestionId: req.body?.suggestionId });
  }
});

export { router as proactiveRouter };
