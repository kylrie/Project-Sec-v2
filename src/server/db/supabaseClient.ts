import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Lazy singleton — not initialized at module load time so missing env vars
// don't crash the server when running in local dev with SQLite fallback.
let _supabaseAdmin: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (_supabaseAdmin) return _supabaseAdmin;

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('FATAL: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in environment');
  }

  _supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  return _supabaseAdmin;
}

/** Quick check — lets callers decide whether to use Supabase or SQLite fallback */
export const isSupabaseConfigured = () =>
  !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_KEY;

export const dbRepository = {
  // 1. Calendar Events
  listCalendarEvents: async (userId: string, dateRange?: { start?: string; end?: string; date?: string }) => {
    let query = getSupabaseAdmin()
      .from('calendar_events')
      .select('*')
      .eq('user_id', userId)
      .order('start_time', { ascending: true });

    if (dateRange?.start && dateRange?.end) {
      query = query.gte('start_time', dateRange.start).lte('end_time', dateRange.end);
    }

    const { data, error } = await query;
    if (error) {
      console.warn('Supabase listCalendarEvents error:', error.message);
      return [];
    }
    return data || [];
  },

  createCalendarEvent: async (userId: string, eventData: {
    title: string;
    startTime: string;
    endTime?: string;
    location?: string;
    hangoutLink?: string;
    attendees?: string[];
    description?: string;
  }) => {
    const now = new Date();
    const startDate = eventData.startTime ? new Date(eventData.startTime) : now;
    const endDate = eventData.endTime ? new Date(eventData.endTime) : new Date(startDate.getTime() + 3600000);

    const { data, error } = await getSupabaseAdmin()
      .from('calendar_events')
      .insert({
        user_id: userId,
        title: eventData.title,
        description: eventData.description || null,
        start_time: startDate.toISOString(),
        end_time: endDate.toISOString(),
        location: eventData.location || 'Executive HQ / Virtual',
        hangout_link: eventData.hangoutLink || null,
        attendees: eventData.attendees || [],
        status: 'confirmed'
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  updateCalendarEvent: async (userId: string, eventId: string, updates: Partial<{
    title: string;
    startTime: string;
    endTime: string;
    location: string;
    status: 'confirmed' | 'tentative' | 'cancelled';
  }>) => {
    const { data, error } = await getSupabaseAdmin()
      .from('calendar_events')
      .update({
        ...(updates.title && { title: updates.title }),
        ...(updates.startTime && { start_time: new Date(updates.startTime).toISOString() }),
        ...(updates.endTime && { end_time: new Date(updates.endTime).toISOString() }),
        ...(updates.location && { location: updates.location }),
        ...(updates.status && { status: updates.status }),
        updated_at: new Date().toISOString()
      })
      .eq('id', eventId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  deleteCalendarEvent: async (userId: string, eventId: string) => {
    const { data, error } = await getSupabaseAdmin()
      .from('calendar_events')
      .delete()
      .eq('id', eventId)
      .eq('user_id', userId)
      .select();

    if (error) throw error;
    return { success: true, count: data?.length || 0 };
  },

  // 2. Tasks
  listTasks: async (userId: string, status: string = 'pending') => {
    let query = getSupabaseAdmin()
      .from('tasks')
      .select('*')
      .eq('user_id', userId);

    if (status !== 'all') {
      query = query.eq('status', status);
    }

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) {
      console.warn('Supabase listTasks error:', error.message);
      return [];
    }
    return data || [];
  },

  createTask: async (userId: string, taskData: {
    title: string;
    dueDate?: string;
    priority?: 'low' | 'medium' | 'high' | 'critical';
    category?: string;
  }) => {
    const { data, error } = await getSupabaseAdmin()
      .from('tasks')
      .insert({
        user_id: userId,
        title: taskData.title,
        due_date: taskData.dueDate ? new Date(taskData.dueDate).toISOString() : null,
        priority: taskData.priority || 'medium',
        status: 'pending',
        category: taskData.category || 'executive'
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  updateTask: async (userId: string, taskId: string, updates: Partial<{
    title: string;
    status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
    priority: 'low' | 'medium' | 'high' | 'critical';
    dueDate: string;
  }>) => {
    const { data, error } = await getSupabaseAdmin()
      .from('tasks')
      .update({
        ...(updates.title && { title: updates.title }),
        ...(updates.status && {
          status: updates.status,
          ...(updates.status === 'completed' ? { completed_at: new Date().toISOString() } : {})
        }),
        ...(updates.priority && { priority: updates.priority }),
        ...(updates.dueDate && { due_date: new Date(updates.dueDate).toISOString() }),
        updated_at: new Date().toISOString()
      })
      .eq('id', taskId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  deleteTask: async (userId: string, taskId: string) => {
    const { error } = await getSupabaseAdmin()
      .from('tasks')
      .delete()
      .eq('id', taskId)
      .eq('user_id', userId);

    if (error) throw error;
    return { success: true };
  },

  // 3. Conversations & AI Neural Memory
  saveConversation: async (params: {
    userId: string;
    sessionId?: string;
    role: string;
    content: string;
    intent?: string;
    actionData?: any;
    toolsUsed?: string[];
    latencyMs?: number;
  }) => {
    const { data, error } = await getSupabaseAdmin()
      .from('conversations')
      .insert({
        user_id: params.userId,
        session_id: params.sessionId || 'default',
        role: params.role,
        content: params.content,
        intent: params.intent || null,
        action_data: params.actionData || null,
        tools_used: params.toolsUsed || [],
        latency_ms: params.latencyMs || null
      })
      .select()
      .single();

    if (error) {
      console.warn('Failed to save conversation to Supabase:', error.message);
      return null;
    }
    return data;
  },

  getRecentConversations: async (userId: string, sessionId: string = 'default', limit: number = 8) => {
    const { data, error } = await getSupabaseAdmin()
      .from('conversations')
      .select('role, content, intent, created_at')
      .eq('user_id', userId)
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.warn('Supabase getRecentConversations error:', error.message);
      return [];
    }
    return (data || []).reverse().map(c => ({
      role: c.role,
      text: c.content,
      intent: c.intent,
      timestamp: new Date(c.created_at).getTime()
    }));
  },

  // 4. User Profile & Preferences
  getUserProfile: async (userId: string) => {
    const { data, error } = await getSupabaseAdmin()
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.warn('getUserProfile error:', error.message);
      return null;
    }
    return data;
  },

  updateUserProfile: async (userId: string, updates: Partial<{
    full_name: string;
    wake_word: string;
    timezone: string;
    personality: string;
    executive_title: string;
    preferred_language: string;
  }>) => {
    const { data, error } = await getSupabaseAdmin()
      .from('profiles')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // 5. Multi-Device Registration & FCM Tokens
  registerDevice: async (userId: string, deviceName: string, platform: 'android' | 'ios' | 'windows' | 'macos' | 'web', pushToken?: string) => {
    const { data, error } = await getSupabaseAdmin()
      .from('devices')
      .upsert({
        user_id: userId,
        device_name: deviceName,
        platform,
        push_token: pushToken || null,
        is_active: true,
        last_seen_at: new Date().toISOString()
      }, { onConflict: 'user_id, device_name' })
      .select()
      .single();

    if (error) {
      // Fallback insert if composite key conflict differs
      const { data: inserted, error: insertError } = await getSupabaseAdmin()
        .from('devices')
        .insert({
          user_id: userId,
          device_name: deviceName,
          platform,
          push_token: pushToken || null,
          is_active: true,
          last_seen_at: new Date().toISOString()
        })
        .select()
        .single();
      if (insertError) throw insertError;
      return inserted;
    }
    return data;
  },

  getUserDevices: async (userId: string) => {
    const { data, error } = await getSupabaseAdmin()
      .from('devices')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (error) throw error;
    return data || [];
  },

  // 6. Notifications Queue
  createNotification: async (userId: string, notification: {
    title: string;
    body: string;
    type?: 'briefing' | 'reminder' | 'meeting_alert' | 'vip_comm' | 'system';
    data?: any;
    scheduledFor?: string;
  }) => {
    const { data, error } = await getSupabaseAdmin()
      .from('notifications')
      .insert({
        user_id: userId,
        title: notification.title,
        body: notification.body,
        type: notification.type || 'reminder',
        data: notification.data || {},
        scheduled_for: notification.scheduledFor || new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }
};
