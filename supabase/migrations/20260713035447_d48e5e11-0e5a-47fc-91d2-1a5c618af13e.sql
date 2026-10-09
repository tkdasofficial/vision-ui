
CREATE TABLE IF NOT EXISTS public.prospecting_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('youtube','web')),
  params JSONB NOT NULL DEFAULT '{}'::jsonb,
  target_count INTEGER NOT NULL DEFAULT 50,
  found_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prospecting_jobs TO authenticated;
GRANT ALL ON public.prospecting_jobs TO service_role;
ALTER TABLE public.prospecting_jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own prospecting jobs" ON public.prospecting_jobs;
CREATE POLICY "own prospecting jobs" ON public.prospecting_jobs FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP TRIGGER IF EXISTS prospecting_jobs_updated ON public.prospecting_jobs;
CREATE TRIGGER prospecting_jobs_updated BEFORE UPDATE ON public.prospecting_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.outreach_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  pitch_context TEXT NOT NULL,
  tone TEXT DEFAULT 'friendly-professional',
  throttle_min_sec INTEGER NOT NULL DEFAULT 45,
  throttle_max_sec INTEGER NOT NULL DEFAULT 90,
  followup_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.outreach_campaigns TO authenticated;
GRANT ALL ON public.outreach_campaigns TO service_role;
ALTER TABLE public.outreach_campaigns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own campaigns" ON public.outreach_campaigns;
CREATE POLICY "own campaigns" ON public.outreach_campaigns FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP TRIGGER IF EXISTS outreach_campaigns_updated ON public.outreach_campaigns;
CREATE TRIGGER outreach_campaigns_updated BEFORE UPDATE ON public.outreach_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='prospecting_jobs') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.prospecting_jobs';
  END IF;
END $$;

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.unschedule('outreach-dispatcher-every-minute') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='outreach-dispatcher-every-minute');
SELECT cron.unschedule('inbox-watcher-every-2-minutes') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='inbox-watcher-every-2-minutes');

SELECT cron.schedule(
  'outreach-dispatcher-every-minute',
  '* * * * *',
  $c$SELECT net.http_post(
    url:='https://ulkbclgngyxmkbygzlxm.supabase.co/functions/v1/outreach-dispatcher',
    headers:='{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsa2JjbGduZ3l4bWtieWd6bHhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2MTQ2OTgsImV4cCI6MjA5NzE5MDY5OH0.9OQ4Zhfg__WJ2_-0JuDxaTZC_8eu6GzLFrcv4qthaKE"}'::jsonb,
    body:='{}'::jsonb
  );$c$
);

SELECT cron.schedule(
  'inbox-watcher-every-2-minutes',
  '*/2 * * * *',
  $c$SELECT net.http_post(
    url:='https://ulkbclgngyxmkbygzlxm.supabase.co/functions/v1/inbox-watcher',
    headers:='{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsa2JjbGduZ3l4bWtieWd6bHhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2MTQ2OTgsImV4cCI6MjA5NzE5MDY5OH0.9OQ4Zhfg__WJ2_-0JuDxaTZC_8eu6GzLFrcv4qthaKE"}'::jsonb,
    body:='{}'::jsonb
  );$c$
);
