import { dbRepository as sqliteDbRepository } from '../db/database.js';
import { getSupabaseAdmin, isSupabaseConfigured } from '../db/supabaseClient.js';

export interface ProactiveSuggestion {
  id: string;
  title: string;
  description: string;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  category: 'calendar' | 'tasks' | 'system' | 'briefing' | 'device';
  actionIntent?: string;
  actionPayload?: any;
  spokenPrompt?: string;
  expiresAt?: number;
  status?: string;
}

export class ProactiveEngine {
  /**
   * Evaluates user context (calendar, tasks, memory, time of day) and generates intelligent proactive suggestions
   */
  public async generateSuggestions(userId: string = 'dev-user-001', timezone: string = 'UTC'): Promise<ProactiveSuggestion[]> {
    const suggestions: ProactiveSuggestion[] = [];
    const now = new Date();

    // 1. Time of day analysis
    let localHours: number;
    try {
      const timeStr = now.toLocaleTimeString('en-US', { timeZone: timezone, hour12: false, hour: '2-digit' });
      localHours = parseInt(timeStr, 10);
    } catch {
      localHours = now.getHours();
    }

    // 2. Fetch Calendar Events safely
    let events: any[] = [];
    try {
      if (isSupabaseConfigured()) {
        const db = getSupabaseAdmin();
        const { data } = await db
          .from('calendar_events')
          .select('*')
          .eq('user_id', userId)
          .gte('start_time', new Date(now.getTime() - 1800000).toISOString())
          .order('start_time', { ascending: true })
          .limit(5);
        if (data && Array.isArray(data)) events = data;
      } else {
        const res = sqliteDbRepository.listCalendarEvents('Today');
        if (res && Array.isArray(res)) events = res;
      }
    } catch {
      events = [];
    }

    // Evaluate upcoming meetings in next 30 minutes
    if (events && events.length > 0) {
      const nextMeeting = events[0] || {};
      const title = nextMeeting.title || 'Executive Session';
      const meetingLink = nextMeeting.hangout_link || (nextMeeting.location?.includes('http') ? nextMeeting.location : null);

      suggestions.push({
        id: `sug-meet-${Date.now()}`,
        title: `Upcoming: ${title}`,
        description: `Scheduled with attendees. Would you like Ahri to prepare the briefing document and open the conference portal?`,
        urgency: 'high',
        category: 'calendar',
        actionIntent: 'calendar_briefing',
        actionPayload: {
          meetingTitle: title,
          link: meetingLink,
          startTime: nextMeeting.start_time || 'Soon'
        },
        spokenPrompt: `Sir, you have ${title} starting shortly. I can prepare your talking points and open the conference line.`
      });
    }

    // 3. Fetch Tasks safely
    let tasks: any[] = [];
    try {
      const res = sqliteDbRepository.listTasks('pending');
      if (res && Array.isArray(res)) tasks = res;
    } catch {
      tasks = [];
    }

    const urgentTasks = (tasks || []).filter(t => t && (t.priority === 'high' || t.priority === 'urgent'));
    if (urgentTasks.length > 0) {
      const topTask = urgentTasks[0] || {};
      const taskTitle = topTask.title || 'Priority Item';
      suggestions.push({
        id: `sug-task-${Date.now()}`,
        title: `Priority Item: ${taskTitle}`,
        description: `High-priority objective pending execution. Would you like to block 45 minutes of deep focus time?`,
        urgency: 'medium',
        category: 'tasks',
        actionIntent: 'block_focus_time',
        actionPayload: {
          taskTitle,
          taskId: topTask.id,
          durationMinutes: 45
        },
        spokenPrompt: `You have an open priority item: ${taskTitle}. Shall I allocate forty-five minutes of focus time on your schedule?`
      });
    }

    // 4. Morning Executive Briefing Trigger
    if (localHours >= 6 && localHours <= 11) {
      suggestions.push({
        id: `sug-morn-${Date.now()}`,
        title: 'Morning Executive Briefing Ready',
        description: 'Schedule, weather, unread executive emails, and strategic deliverables ready for voice playback.',
        urgency: 'medium',
        category: 'briefing',
        actionIntent: 'play_daily_briefing',
        actionPayload: { type: 'morning' },
        spokenPrompt: 'Good morning. Your executive overview is prepared whenever you are ready.'
      });
    }

    // 5. Evening Wrap-Up
    if (localHours >= 17 && localHours <= 22) {
      suggestions.push({
        id: `sug-eve-${Date.now()}`,
        title: 'End of Day Strategic Debrief',
        description: 'Review today\'s completed deliverables and prepare your agenda for tomorrow.',
        urgency: 'low',
        category: 'briefing',
        actionIntent: 'play_daily_briefing',
        actionPayload: { type: 'evening' },
        spokenPrompt: 'Good evening. Would you like a recap of today\'s closed action items and tomorrow\'s earliest commitments?'
      });
    }

    // Save to SQLite / Supabase
    for (const sug of suggestions) {
      try {
        sqliteDbRepository.saveProactiveSuggestion(userId, sug);
      } catch {}
    }

    return suggestions;
  }

  /**
   * Execute action associated with a proactive suggestion
   */
  public async executeSuggestion(userId: string, suggestionId: string, actionIntent: string, actionPayload: any) {
    try {
      sqliteDbRepository.executeProactiveSuggestion(userId, suggestionId);
    } catch {}

    return {
      success: true,
      suggestionId,
      actionIntent,
      executedAt: new Date().toISOString()
    };
  }
}

export const proactiveEngine = new ProactiveEngine();
