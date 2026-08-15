import { Router } from 'express';
import { authMiddleware, AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { parseActionIntent, ActionIntent } from '../services/actionBroker.js';

const router = Router();

export interface ActionResult {
  success: boolean;
  method: string;
  link: string | null;
  spokenConfirmation: string;
  requiresManualCompletion: boolean;
  error?: string;
}

// Step 1: Parse intent
router.post('/parse', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'message is required' });
    }
    const intent = await parseActionIntent(message);
    res.json({ intent });
  } catch (err: any) {
    console.error('[ActionRouter] Parse exception:', err);
    res.status(500).json({ error: err.message || 'Failed to parse action intent' });
  }
});

// Step 2: Execute after confirmation
router.post('/execute', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { intent } = req.body;
    if (!intent) {
      return res.status(400).json({ error: 'intent is required' });
    }
    
    const result: ActionResult = await executeAction(intent);
    res.json({
      success: result.success,
      details: result,
      link: result.link,
      spokenConfirmation: result.spokenConfirmation
    });
  } catch (err: any) {
    console.error('[ActionRouter] Execute exception:', err);
    res.status(500).json({ error: err.message || 'Failed to execute action' });
  }
});

export { router as actionRouter };

async function executeAction(intent: any): Promise<ActionResult> {
  switch (intent.category) {
    case 'food':
      return await executeFoodOrder(intent);
    case 'transport':
      return await executeTransportBooking(intent);
    case 'payment':
      return await executePayment(intent);
    case 'shopping':
      return await executeShopping(intent);
    default:
      return {
        success: true,
        method: 'generic',
        link: null,
        spokenConfirmation: `Action acknowledged for ${intent.action || 'request'}.`,
        requiresManualCompletion: false
      };
  }
}

async function executeFoodOrder(intent: any): Promise<ActionResult> {
  const itemName = intent.items && intent.items[0] ? intent.items[0].name : 'order';
  const deepLinks: Record<string, (i: any) => string> = {
    dominos: (i: any) => `https://www.dominos.com/en/pages/order/#/product/S_PIZZA/builder/?code=${encodeURIComponent(i.items?.[0]?.name || 'PIZZA')}`,
    grabfood: (i: any) => `grabfood://search?query=${encodeURIComponent(i.items?.[0]?.name || '')}`,
    foodpanda: (i: any) => `foodpanda://v2/search?q=${encodeURIComponent(i.items?.[0]?.name || '')}`
  };
  
  const linkFn = deepLinks[intent.service?.toLowerCase()] || deepLinks.dominos;
  const link = linkFn(intent);
  
  return {
    success: true,
    method: 'deep_link',
    link,
    spokenConfirmation: `I've prepared your ${itemName} order in ${intent.service || 'delivery'}. Opening the app now.`,
    requiresManualCompletion: true
  };
}

async function executeTransportBooking(intent: any): Promise<ActionResult> {
  const links: Record<string, string> = {
    grab: `grab://open?screen=bookRide`,
    uber: `uber://?action=setPickup`,
    angkas: `angkas://book`
  };
  
  const link = links[intent.service?.toLowerCase()] || links.grab;
  
  return {
    success: true,
    method: 'deep_link',
    link,
    spokenConfirmation: `Opening ${intent.service || 'transport'} for you.`,
    requiresManualCompletion: true
  };
}

async function executePayment(intent: any): Promise<ActionResult> {
  const links: Record<string, (i: any) => string> = {
    gcash: (i: any) => `gcash://send?amount=${i.amount || 0}&recipient=${encodeURIComponent(i.recipient || '')}`,
    maya: (i: any) => `maya://send?amount=${i.amount || 0}&to=${encodeURIComponent(i.recipient || '')}`
  };
  
  const linkFn = links[intent.service?.toLowerCase()] || links.gcash;
  const link = linkFn(intent);
  
  return {
    success: true,
    method: 'deep_link',
    link,
    spokenConfirmation: `Opening ${intent.service || 'payment'} to send ₱${intent.amount || 0} to ${intent.recipient || 'recipient'}. Please confirm in the app.`,
    requiresManualCompletion: true
  };
}

async function executeShopping(intent: any): Promise<ActionResult> {
  const link = `https://www.google.com/search?q=${encodeURIComponent(intent.items?.[0]?.name || 'shopping')}`;
  return {
    success: true,
    method: 'deep_link',
    link,
    spokenConfirmation: `Finding best price options for ${intent.items?.[0]?.name || 'item'}.`,
    requiresManualCompletion: true
  };
}
