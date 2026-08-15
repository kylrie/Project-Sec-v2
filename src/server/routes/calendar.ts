import { Router, Response } from 'express';
import { authMiddleware, AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { dbRepository } from '../db/supabaseClient.js';

export const calendarRouter = Router();

// Apply auth middleware to all calendar routes
calendarRouter.use(authMiddleware);

// GET /api/calendar/events - List calendar events for authenticated user
calendarRouter.get('/events', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.uid;
    const { start, end, date } = req.query as { start?: string; end?: string; date?: string };
    
    const events = await dbRepository.listCalendarEvents(userId, { start, end, date });
    res.json(events);
  } catch (error: any) {
    console.error('GET /api/calendar/events error:', error);
    res.status(500).json({ error: 'Failed to retrieve calendar events', details: error.message });
  }
});

// POST /api/calendar/events - Create new event
calendarRouter.post('/events', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.uid;
    const { title, startTime, endTime, location, hangoutLink, attendees, description } = req.body;

    if (!title || !startTime) {
      return res.status(400).json({ error: 'title and startTime are required parameters' });
    }

    const newEvent = await dbRepository.createCalendarEvent(userId, {
      title,
      startTime,
      endTime,
      location,
      hangoutLink,
      attendees,
      description
    });

    res.status(201).json(newEvent);
  } catch (error: any) {
    console.error('POST /api/calendar/events error:', error);
    res.status(500).json({ error: 'Failed to create calendar event', details: error.message });
  }
});

// PUT /api/calendar/events/:id - Update existing event
calendarRouter.put('/events/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.uid;
    const eventId = req.params.id;

    const updated = await dbRepository.updateCalendarEvent(userId, eventId, req.body);
    res.json(updated);
  } catch (error: any) {
    console.error('PUT /api/calendar/events/:id error:', error);
    res.status(500).json({ error: 'Failed to update calendar event', details: error.message });
  }
});

// DELETE /api/calendar/events/:id - Delete event
calendarRouter.delete('/events/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.uid;
    const eventId = req.params.id;

    const result = await dbRepository.deleteCalendarEvent(userId, eventId);
    res.json(result);
  } catch (error: any) {
    console.error('DELETE /api/calendar/events/:id error:', error);
    res.status(500).json({ error: 'Failed to delete calendar event', details: error.message });
  }
});
