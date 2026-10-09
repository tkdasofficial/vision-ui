
-- Extend leads
ALTER TABLE public.leads ALTER COLUMN workflow_id DROP NOT NULL;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS subscriber_count INT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS avg_views INT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS niche TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS industry TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS campaign_id UUID;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS prospecting_job_id UUID;

-- Extend email_queue
ALTER TABLE public.email_queue ALTER COLUMN workflow_id DROP NOT NULL;
ALTER TABLE public.email_queue ADD COLUMN IF NOT EXISTS gmail_thread_id TEXT;
ALTER TABLE public.email_queue ADD COLUMN IF NOT EXISTS campaign_id UUID;
ALTER TABLE public.email_queue ADD COLUMN IF NOT EXISTS in_reply_to TEXT;

-- prospecting_jobs
CREATE TABLE IF NOT EXISTS public.prospecting_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  source TEXT NOT NULL, -- 'youtube' | 'web' | 'both'
  params JSONB NOT NULL DEFAULT '{}'::jsonb,
  target_count INT NOT NULL DEFAULT 50,
  found_count INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending', -- pending|running|done|error|cancelled
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prospecting_jobs TO authenticated;
GRANT ALL ON public.prospecting_jobs TO service_role;
ALTER TABLE public.prospecting_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own prospecting_jobs" ON public.prospecting_jobs FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER prospecting_jobs_updated_at BEFORE UPDATE ON public.prospecting_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- outreach_campaigns
CREATE TABLE IF NOT EXISTS public.outreach_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL DEFAULT 'Untitled Campaign',
  pitch_context TEXT NOT NULL DEFAULT '',
  tone TEXT NOT NULL DEFAULT 'friendly-professional',
  follow_up_enabled BOOLEAN NOT NULL DEFAULT false,
  throttle_min_sec INT NOT NULL DEFAULT 45,
  throttle_max_sec INT NOT NULL DEFAULT 90,
  daily_cap INT NOT NULL DEFAULT 400,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.outreach_campaigns TO authenticated;
GRANT ALL ON public.outreach_campaigns TO service_role;
ALTER TABLE public.outreach_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own outreach_campaigns" ON public.outreach_campaigns FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER outreach_campaigns_updated_at BEFORE UPDATE ON public.outreach_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- user_settings theme
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS theme TEXT NOT NULL DEFAULT 'system';

-- Realtime
ALTER TABLE public.leads REPLICA IDENTITY FULL;
ALTER TABLE public.email_queue REPLICA IDENTITY FULL;
ALTER TABLE public.prospecting_jobs REPLICA IDENTITY FULL;
DO $$ BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.prospecting_jobs; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
