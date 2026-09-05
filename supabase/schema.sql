-- ==========================================================================
-- Aulert Database Schema (v3)
-- Compliant with Technical Architecture & PRD specs
-- Includes RLS policies, Vault setup, and performance indexes
-- ==========================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- --------------------------------------------------------------------------
-- 1. Users Table
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  google_id TEXT UNIQUE,
  email TEXT NOT NULL,
  discord_user_id TEXT,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  needs_reauth BOOLEAN NOT NULL DEFAULT false,
  pubsub_subscription_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --------------------------------------------------------------------------
-- 2. Courses Table
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  classroom_course_id TEXT NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT 'course-1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_user_classroom_course UNIQUE(user_id, classroom_course_id)
);

-- --------------------------------------------------------------------------
-- 3. Classroom Items Table (Assignments & Announcements)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.classroom_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  classroom_item_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('assignment', 'announcement')),
  title TEXT NOT NULL,
  description TEXT,
  due_at TIMESTAMPTZ,
  submission_status TEXT NOT NULL DEFAULT 'assigned',
  link TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_course_classroom_item UNIQUE(course_id, classroom_item_id)
);

-- --------------------------------------------------------------------------
-- 4. Homework Items Table (Custom Student Tasks)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.homework_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  due_at TIMESTAMPTZ,
  notes TEXT,
  completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --------------------------------------------------------------------------
-- 5. Discord Connections Table
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.discord_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('webhook', 'bot_channel')),
  webhook_url_vault_id UUID,
  webhook_url_ciphertext TEXT,
  channel_id TEXT,
  guild_id TEXT,
  channel_name TEXT,
  guild_name TEXT,
  muted BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'broken')),
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --------------------------------------------------------------------------
-- 6. Alert Log Table (Idempotency Engine)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.alert_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  item_id UUID NOT NULL,
  item_type TEXT NOT NULL CHECK (item_type IN ('classroom_item', 'homework_item')),
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('instant', 'late')),
  sent_via TEXT NOT NULL CHECK (sent_via IN ('dm', 'bot_channel', 'webhook')),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  idempotency_key TEXT NOT NULL UNIQUE
);

-- --------------------------------------------------------------------------
-- 7. Webhook Send Queue Table (Railway Worker)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.webhook_send_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  connection_id UUID NOT NULL REFERENCES public.discord_connections(id) ON DELETE CASCADE,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'sent', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --------------------------------------------------------------------------
-- 8. Pending Classroom Reads Table (Rate Limit Batching)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pending_classroom_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  classroom_item_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --------------------------------------------------------------------------
-- 9. System Logs Table (Monitoring & Observability)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.system_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level TEXT NOT NULL DEFAULT 'info' CHECK (level IN ('info', 'warn', 'error', 'critical')),
  source TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==========================================================================
-- Performance Indexes (Section 8.1)
-- ==========================================================================
CREATE INDEX IF NOT EXISTS idx_classroom_items_course_due ON public.classroom_items (course_id, due_at);
CREATE INDEX IF NOT EXISTS idx_homework_items_user_due ON public.homework_items (user_id, due_at);
CREATE INDEX IF NOT EXISTS idx_alert_log_dedup ON public.alert_log (item_id, item_type, sent_at);
CREATE INDEX IF NOT EXISTS idx_discord_connections_user ON public.discord_connections (user_id);
CREATE INDEX IF NOT EXISTS idx_pending_reads_user_created ON public.pending_classroom_reads (user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_webhook_queue_poll ON public.webhook_send_queue (status, next_attempt_at) WHERE status IN ('pending', 'sending');
CREATE INDEX IF NOT EXISTS idx_users_pubsub_expiry ON public.users (pubsub_subscription_expires_at) WHERE pubsub_subscription_expires_at IS NOT NULL;

-- ==========================================================================
-- Row-Level Security (RLS) Policies (Section 7.3)
-- ==========================================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classroom_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homework_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discord_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_send_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_classroom_reads ENABLE ROW LEVEL SECURITY;

-- users policy
CREATE POLICY user_self_access ON public.users
  FOR ALL USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- courses policy
CREATE POLICY courses_user_isolation ON public.courses
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- classroom_items policy (nested join through courses)
CREATE POLICY classroom_items_isolation ON public.classroom_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.courses
      WHERE courses.id = classroom_items.course_id
      AND courses.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.courses
      WHERE courses.id = classroom_items.course_id
      AND courses.user_id = auth.uid()
    )
  );

-- homework_items policy
CREATE POLICY homework_user_isolation ON public.homework_items
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- discord_connections policy
CREATE POLICY discord_connections_isolation ON public.discord_connections
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- alert_log policy
CREATE POLICY alert_log_isolation ON public.alert_log
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- webhook_send_queue policy
CREATE POLICY webhook_queue_isolation ON public.webhook_send_queue
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- pending_classroom_reads policy
CREATE POLICY pending_reads_isolation ON public.pending_classroom_reads
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
