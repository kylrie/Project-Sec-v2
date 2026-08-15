import { Router } from 'express';
import { authMiddleware, AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { generateSuggestions, gatherUserContext } from '../services/suggestionEngine.js';

const router = Router();

router.get('/proactive', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.uid || 'dev-user-001';
    
    // Gather context
    const context = await gatherUserContext(userId);
    const suggestions = await generateSuggestions(userId, context);
    
    res.json({ suggestions, generatedAt: new Date().toISOString() });
  } catch (err: any) {
    console.error('[SuggestionsRouter] Error generating suggestions:', err);
    res.status(500).json({ error: err.message || 'Failed to generate suggestions' });
  }
});

router.post('/feedback', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { suggestionId, action } = req.body; // action: 'accepted' | 'dismissed' | 'snoozed'
    console.log(`[SuggestionsRouter] Feedback recorded for suggestion ${suggestionId}: ${action}`);
    res.json({ status: 'recorded', suggestionId, action });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to record feedback' });
  }
});

export { router as suggestionRouter };
