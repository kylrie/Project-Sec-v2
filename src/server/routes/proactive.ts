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
    res.json({ suggestions: fresh });
  } catch (err: any) {
    console.error('[ProactiveRouter] Error fetching suggestions:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch proactive suggestions' });
  }
});

// POST /api/proactive/execute
router.post('/execute', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.uid || 'dev-user-001';
    const { suggestionId, actionIntent, actionPayload } = req.body;

    const result = await proactiveEngine.executeSuggestion(userId, suggestionId, actionIntent, actionPayload);
    res.json(result);
  } catch (err: any) {
    console.error('[ProactiveRouter] Error executing suggestion:', err);
    res.status(500).json({ error: err.message || 'Failed to execute suggestion' });
  }
});

// POST /api/proactive/dismiss
router.post('/dismiss', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.uid || 'dev-user-001';
    const { suggestionId } = req.body;

    sqliteDbRepository.dismissProactiveSuggestion(userId, suggestionId);
    res.json({ success: true, suggestionId });
  } catch (err: any) {
    console.error('[ProactiveRouter] Error dismissing suggestion:', err);
    res.status(500).json({ error: err.message || 'Failed to dismiss suggestion' });
  }
});

export { router as proactiveRouter };
