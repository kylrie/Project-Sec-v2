import { getSupabaseAdmin, isSupabaseConfigured } from '../db/supabaseClient.js';
import { dbRepository as sqliteDbRepository } from '../db/database.js';

export interface ContextSnapshot {
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
  upcomingEvents: any[];
  unreadCount: number;
  location: string;
  weather: string;
  lastWorkout: Date | null;
  pendingTasks: number;
}

export interface SuggestionItem {
  id: string;
  type: 'calendar' | 'health' | 'communication' | 'shopping' | 'task' | 'general';
  priority: 'high' | 'medium' | 'low';
  title: string;
  message: string;
  action: {
    type: 'navigate' | 'block_calendar' | 'summarize_inbox' | 'open_app' | 'complete_task' | string;
    destination?: string;
    duration?: string;
    title?: string;
    app?: string;
    [key: string]: any;
  };
  confidence: number;
}

export async function gatherUserContext(userId: string = 'dev-user-001'): Promise<ContextSnapshot> {
  const now = new Date();
  const hours = now.getHours();

  let timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night' = 'morning';
  if (hours >= 5 && hours < 12) {
    timeOfDay = 'morning';
  } else if (hours >= 12 && hours < 17) {
    timeOfDay = 'afternoon';
  } else if (hours >= 17 && hours < 22) {
    timeOfDay = 'evening';
  } else {
    timeOfDay = 'night';
  }

  let upcomingEvents: any[] = [];
  let unreadCount = 0;
  let pendingTasks = 0;

  if (isSupabaseConfigured()) {
    try {
      const db = getSupabaseAdmin();
      const { data: events } = await db
        .from('calendar_events')
        .select('*')
        .eq('user_id', userId)
        .gte('start_time', now.toISOString())
        .order('start_time', { ascending: true })
        .limit(5);

      if (events) upcomingEvents = events;
    } catch {}
  }

  if (upcomingEvents.length === 0) {
    try {
      upcomingEvents = sqliteDbRepository.listCalendarEvents('Today');
    } catch {}
  }

  try {
    const emails = sqliteDbRepository.listEmails(true);
    unreadCount = emails.length || 6;
  } catch {
    unreadCount = 6;
  }

  try {
    const tasks = sqliteDbRepository.listTasks('pending');
    pendingTasks = tasks.length || 3;
  } catch {
    pendingTasks = 3;
  }

  return {
    timeOfDay,
    upcomingEvents,
    unreadCount,
    location: 'near_office',
    weather: 'Sunny 72°F',
    lastWorkout: new Date(Date.now() - 4 * 86400000), // 4 days ago
    pendingTasks
  };
}

export async function generateSuggestions(userId: string, context: ContextSnapshot): Promise<SuggestionItem[]> {
  const suggestions: SuggestionItem[] = [];

  // Time-based & Calendar
  if (context.timeOfDay === 'morning' && context.upcomingEvents.length > 0) {
    const firstEvent = context.upcomingEvents[0];
    suggestions.push({
      id: 'morning-commute',
      type: 'calendar',
      priority: 'high',
      title: 'Leave early for meeting',
      message: `Your ${firstEvent.title || 'Executive Session'} is at ${firstEvent.start_time || '10:00 AM'}. Traffic looks heavy.`,
      action: { type: 'navigate', destination: firstEvent.location || 'HQ Conference Room' },
      confidence: 0.92
    });
  }

  // Health-based
  if (context.lastWorkout && Date.now() - new Date(context.lastWorkout).getTime() > 3 * 86400000) {
    suggestions.push({
      id: 'workout-reminder',
      type: 'health',
      priority: 'medium',
      title: 'Workout overdue',
      message: `You haven't worked out in 3 days. Your 2 PM slot is free today.`,
      action: { type: 'block_calendar', duration: '1 hour', title: 'Gym' },
      confidence: 0.78
    });
  }

  // Communication-based
  if (context.unreadCount > 5) {
    suggestions.push({
      id: 'inbox-backlog',
      type: 'communication',
      priority: 'medium',
      title: 'Inbox piling up',
      message: `${context.unreadCount} unread messages. Want me to summarize the urgent ones?`,
      action: { type: 'summarize_inbox' },
      confidence: 0.85
    });
  }

  // Shopping-based (near store)
  if (context.location === 'near_mall' || context.location === 'near_office') {
    suggestions.push({
      id: 'shopping-opportunity',
      type: 'shopping',
      priority: 'low',
      title: 'Wishlist item nearby',
      message: 'You added running shoes to your wishlist. The Nike store here has a 20% sale.',
      action: { type: 'open_app', app: 'nike' },
      confidence: 0.65
    });
  }

  return suggestions.sort((a, b) => b.confidence - a.confidence).slice(0, 3);
}
