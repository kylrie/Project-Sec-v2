-- =============================================================================
-- PROJECT AHRI / FRIDAY: SUPABASE POSTGRESQL SCHEMA WITH RLS & REALTIME
-- Migration: 001_friday_schema.sql
-- =============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- 1. PROFILES (Extends auth.users with Executive Preferences)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  executive_title TEXT DEFAULT 'Chief Executive Officer',
  timezone TEXT DEFAULT 'America/New_York',
  preferred_language TEXT DEFAULT 'en-US',
  wake_word TEXT DEFAULT 'Hey Ahri',
  personality TEXT DEFAULT 'professional',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- 2. DEVICES (Multi-Device Tracking & FCM Push Notification Registry)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_name TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('android', 'ios', 'windows', 'macos', 'web')),
  push_token TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- 3. CALENDAR EVENTS (Executive Schedule & Meeting Agendas)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  location TEXT,
  hangout_link TEXT,
  attendees JSONB DEFAULT '[]'::jsonb,
  status TEXT DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'tentative', 'cancelled')),
  is_conflict BOOLEAN DEFAULT FALSE,
  synced_with_google BOOLEAN DEFAULT FALSE,
  google_event_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- 4. TASKS (Action Items & Executive Priorities)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  due_date TIMESTAMPTZ,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  category TEXT DEFAULT 'executive',
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- 5. EMAILS (Cached Inbound / Outbound Workspace Messages)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  thread_id TEXT,
  from_name TEXT NOT NULL,
  from_email TEXT NOT NULL,
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  snippet TEXT,
  is_unread BOOLEAN DEFAULT TRUE,
  urgency TEXT DEFAULT 'standard' CHECK (urgency IN ('urgent', 'standard', 'newsletter')),
  summary_sentence TEXT,
  suggested_reply TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- 6. CONVERSATIONS (Persistent Context & AI Neural Memory)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL DEFAULT 'default',
  role TEXT NOT NULL CHECK (role IN ('user', 'ahri', 'friday', 'assistant', 'system')),
  content TEXT NOT NULL,
  intent TEXT,
  action_data JSONB,
  tools_used TEXT[],
  latency_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- 7. VOICE SETTINGS (Per-User Neural Acoustic & Persona Configuration)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.voice_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  voice_name TEXT DEFAULT 'Natural Expressive',
  elevenlabs_voice_id TEXT,
  rate REAL DEFAULT 1.05,
  pitch REAL DEFAULT 1.0,
  volume REAL DEFAULT 1.0,
  continuous_listening BOOLEAN DEFAULT TRUE,
  barge_in_enabled BOOLEAN DEFAULT TRUE,
  vad_sensitivity REAL DEFAULT 0.7,
  sound_effects BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- 8. MEETINGS (Transcripts, Minutes, Decisions & Action Items)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Executive Session',
  transcript TEXT,
  executive_summary JSONB DEFAULT '[]'::jsonb,
  detailed_minutes JSONB DEFAULT '[]'::jsonb,
  key_decisions JSONB DEFAULT '[]'::jsonb,
  action_items JSONB DEFAULT '[]'::jsonb,
  duration_seconds INTEGER DEFAULT 0,
  audio_recording_url TEXT,
  start_time TIMESTAMPTZ DEFAULT NOW(),
  end_time TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- 9. NOTIFICATIONS (Proactive Executive Alert & Dispatch Queue)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB DEFAULT '{}'::jsonb,
  type TEXT DEFAULT 'reminder' CHECK (type IN ('briefing', 'reminder', 'meeting_alert', 'vip_comm', 'system')),
  is_read BOOLEAN DEFAULT FALSE,
  is_dispatched BOOLEAN DEFAULT FALSE,
  scheduled_for TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- INDEXES FOR MAXIMUM QUERY PERFORMANCE
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_devices_user_id ON public.devices(user_id);
CREATE INDEX IF NOT EXISTS idx_devices_push_token ON public.devices(push_token);

CREATE INDEX IF NOT EXISTS idx_calendar_user_id ON public.calendar_events(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_start_time ON public.calendar_events(start_time);
CREATE INDEX IF NOT EXISTS idx_calendar_status ON public.calendar_events(status);

CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON public.tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON public.tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON public.tasks(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_emails_user_id ON public.emails(user_id);
CREATE INDEX IF NOT EXISTS idx_emails_unread ON public.emails(user_id, is_unread);

CREATE INDEX IF NOT EXISTS idx_conversations_user_session ON public.conversations(user_id, session_id);
CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON public.conversations(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_meetings_user_id ON public.meetings(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_scheduled ON public.notifications(scheduled_for, is_dispatched);

-- =============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES - STRICT ZERO-TRUST MULTI-TENANCY
-- =============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 1. Profiles Policies
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- 2. Devices Policies
CREATE POLICY "Users can manage own devices" ON public.devices FOR ALL USING (auth.uid() = user_id);

-- 3. Calendar Events Policies
CREATE POLICY "Users can manage own calendar events" ON public.calendar_events FOR ALL USING (auth.uid() = user_id);

-- 4. Tasks Policies
CREATE POLICY "Users can manage own tasks" ON public.tasks FOR ALL USING (auth.uid() = user_id);

-- 5. Emails Policies
CREATE POLICY "Users can manage own emails" ON public.emails FOR ALL USING (auth.uid() = user_id);

-- 6. Conversations Policies
CREATE POLICY "Users can manage own conversations" ON public.conversations FOR ALL USING (auth.uid() = user_id);

-- 7. Voice Settings Policies
CREATE POLICY "Users can manage own voice settings" ON public.voice_settings FOR ALL USING (auth.uid() = user_id);

-- 8. Meetings Policies
CREATE POLICY "Users can manage own meetings" ON public.meetings FOR ALL USING (auth.uid() = user_id);

-- 9. Notifications Policies
CREATE POLICY "Users can manage own notifications" ON public.notifications FOR ALL USING (auth.uid() = user_id);

-- =============================================================================
-- AUTO-CREATE PROFILE & VOICE SETTINGS TRIGGER ON USER SIGNUP
-- =============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', 'Executive User'),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.voice_settings (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================================================
-- ENABLE SUPABASE REALTIME REPLICATION FOR LIVE MULTI-DEVICE SYNC
-- =============================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.calendar_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
