-- =============================================================================
-- PROJECT AHRI: NEURAL DEVICE MESH & PROACTIVE ACTION BROKER
-- Migration: 002_device_mesh.sql
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.device_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_name TEXT NOT NULL,
  device_type TEXT NOT NULL CHECK (device_type IN ('windows_pc', 'android_phone', 'android_tablet', 'smart_hub', 'smart_light', 'smart_speaker', 'security_cam', 'iot_sensor')),
  platform TEXT NOT NULL,
  local_ip TEXT,
  ws_connected BOOLEAN DEFAULT false,
  last_seen TIMESTAMPTZ DEFAULT now(),
  capabilities JSONB DEFAULT '[]'::jsonb, -- e.g., ["shutdown", "volume_control", "screen_capture", "light_control"]
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, device_name)
);

CREATE INDEX IF NOT EXISTS idx_device_nodes_user ON public.device_nodes(user_id);
CREATE INDEX IF NOT EXISTS idx_device_nodes_ws ON public.device_nodes(ws_connected);

-- Proactive Suggestions & Executive Recommendations
CREATE TABLE IF NOT EXISTS public.proactive_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  urgency TEXT NOT NULL DEFAULT 'medium' CHECK (urgency IN ('low', 'medium', 'high', 'critical')),
  category TEXT NOT NULL DEFAULT 'calendar' CHECK (category IN ('calendar', 'tasks', 'system', 'briefing', 'device')),
  action_intent TEXT,
  action_payload JSONB DEFAULT '{}'::jsonb,
  spoken_prompt TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'executed', 'dismissed', 'expired')),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_proactive_suggestions_user ON public.proactive_suggestions(user_id, status);

-- Enable RLS
ALTER TABLE public.device_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proactive_suggestions ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users manage own devices" ON public.device_nodes
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users manage own suggestions" ON public.proactive_suggestions
  FOR ALL USING (auth.uid() = user_id);
