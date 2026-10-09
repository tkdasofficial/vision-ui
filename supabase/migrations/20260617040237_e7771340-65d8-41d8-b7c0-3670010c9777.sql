
-- Update plan gate to accept new tiers
CREATE OR REPLACE FUNCTION public.can_use_own_keys(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE user_id = _user_id
      AND status = 'active'
      AND plan IN ('starter','creator','studio','business','basic','pro')
  );
$$;

-- ============ profiles.is_banned ============
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_banned BOOLEAN NOT NULL DEFAULT false;

-- ============ plan_limits ============
CREATE TABLE IF NOT EXISTS public.plan_limits (
  plan TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  price_monthly NUMERIC(10,2) NOT NULL,
  price_yearly NUMERIC(10,2) NOT NULL,
  tagline TEXT,
  features JSONB NOT NULL DEFAULT '[]'::jsonb,
  limits JSONB NOT NULL DEFAULT '{}'::jsonb,
  sort_order INT NOT NULL DEFAULT 0,
  popular BOOLEAN NOT NULL DEFAULT false,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.plan_limits TO anon, authenticated;
GRANT ALL ON public.plan_limits TO service_role;
ALTER TABLE public.plan_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read plan limits" ON public.plan_limits FOR SELECT USING (true);
CREATE POLICY "admins manage plan limits" ON public.plan_limits
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_plan_limits_updated BEFORE UPDATE ON public.plan_limits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.plan_limits (plan, display_name, price_monthly, price_yearly, tagline, features, limits, sort_order, popular) VALUES
('free','Free',0,0,'For exploring the platform',
  '["50 AI chat messages / mo","20 images / mo","5 minutes TTS / mo","Shared AI pool","Standard models","Community support"]'::jsonb,
  '{"chat":50,"image":20,"video":0,"audio_minutes":5,"own_keys":false}'::jsonb,1,false),
('starter','Starter',15,150,'For hobbyists and side projects',
  '["500 AI chat messages / mo","200 images / mo","30 minutes TTS / mo","2 short videos / mo","Connect your own API keys","All providers (OpenAI, Gemini, Claude...)","Email support"]'::jsonb,
  '{"chat":500,"image":200,"video":2,"audio_minutes":30,"own_keys":true}'::jsonb,2,false),
('creator','Creator',39,390,'For content creators and freelancers',
  '["2,000 AI chat messages / mo","1,000 images / mo","120 minutes TTS / mo","20 videos / mo","Long-form video pipeline","All integrations & OAuth","Priority email support","Remove watermark"]'::jsonb,
  '{"chat":2000,"image":1000,"video":20,"audio_minutes":120,"own_keys":true}'::jsonb,3,true),
('studio','Studio',99,990,'For agencies and power users',
  '["10,000 AI chat messages / mo","5,000 images / mo","600 minutes TTS / mo","100 videos / mo","Background tasks queue","Premium models (GPT-5, Gemini Pro)","Web app builder unlimited","Dedicated support channel"]'::jsonb,
  '{"chat":10000,"image":5000,"video":100,"audio_minutes":600,"own_keys":true}'::jsonb,4,false),
('business','Business',299,2990,'For teams and high-volume workloads',
  '["Unlimited AI chat","Unlimited images & TTS","500 videos / mo","Team seats (up to 10)","SSO + audit logs","SLA + dedicated CSM","Custom integrations","White-label option"]'::jsonb,
  '{"chat":-1,"image":-1,"video":500,"audio_minutes":-1,"own_keys":true,"seats":10}'::jsonb,5,false)
ON CONFLICT (plan) DO UPDATE SET
  display_name=EXCLUDED.display_name, price_monthly=EXCLUDED.price_monthly, price_yearly=EXCLUDED.price_yearly,
  tagline=EXCLUDED.tagline, features=EXCLUDED.features, limits=EXCLUDED.limits,
  sort_order=EXCLUDED.sort_order, popular=EXCLUDED.popular;

-- ============ ai_usage_logs ============
CREATE TABLE IF NOT EXISTS public.ai_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  function_name TEXT NOT NULL,
  provider TEXT,
  capability TEXT,
  source TEXT,
  status TEXT NOT NULL DEFAULT 'ok',
  tokens INT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_usage_user_created ON public.ai_usage_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_created ON public.ai_usage_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_function ON public.ai_usage_logs(function_name);
GRANT SELECT ON public.ai_usage_logs TO authenticated;
GRANT ALL ON public.ai_usage_logs TO service_role;
ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own usage" ON public.ai_usage_logs FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

-- ============ support_tickets ============
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'normal',
  status TEXT NOT NULL DEFAULT 'open',
  admin_reply TEXT,
  replied_by UUID REFERENCES auth.users(id),
  replied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.support_tickets TO authenticated;
GRANT ALL ON public.support_tickets TO service_role;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own tickets" ON public.support_tickets FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "users insert own tickets" ON public.support_tickets FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admins update tickets" ON public.support_tickets FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_tickets_updated BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ announcements ============
CREATE TABLE IF NOT EXISTS public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  level TEXT NOT NULL DEFAULT 'info',
  active BOOLEAN NOT NULL DEFAULT true,
  starts_at TIMESTAMPTZ DEFAULT now(),
  ends_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.announcements TO anon, authenticated;
GRANT ALL ON public.announcements TO service_role;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read active announcements" ON public.announcements FOR SELECT
  USING (active = true AND (ends_at IS NULL OR ends_at > now()));
CREATE POLICY "admins manage announcements" ON public.announcements FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============ feature_flags ============
CREATE TABLE IF NOT EXISTS public.feature_flags (
  key TEXT PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT false,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.feature_flags TO authenticated;
GRANT ALL ON public.feature_flags TO service_role;
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read flags" ON public.feature_flags FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins manage flags" ON public.feature_flags FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
INSERT INTO public.feature_flags (key, enabled, description) VALUES
  ('maintenance_mode', false, 'Show maintenance banner and block AI requests'),
  ('signups_enabled', true, 'Allow new account signups'),
  ('byok_enabled', true, 'Allow paid users to connect their own API keys'),
  ('video_generation_enabled', true, 'Enable video generation feature'),
  ('web_app_builder_enabled', true, 'Enable web app builder feature')
ON CONFLICT (key) DO NOTHING;

-- ============ admin_audit_log ============
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES auth.users(id),
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON public.admin_audit_log(created_at DESC);
GRANT SELECT, INSERT ON public.admin_audit_log TO authenticated;
GRANT ALL ON public.admin_audit_log TO service_role;
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read audit" ON public.admin_audit_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admins write audit" ON public.admin_audit_log FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') AND admin_id = auth.uid());
