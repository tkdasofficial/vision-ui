
ALTER TABLE public.user_integrations
  ADD COLUMN IF NOT EXISTS access_token TEXT,
  ADD COLUMN IF NOT EXISTS refresh_token TEXT,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS scopes TEXT;

CREATE TABLE IF NOT EXISTS public.oauth_states (
  state TEXT PRIMARY KEY,
  user_id UUID NOT NULL,
  provider TEXT NOT NULL,
  redirect_to TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '10 minutes')
);

GRANT ALL ON public.oauth_states TO service_role;
ALTER TABLE public.oauth_states ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role only" ON public.oauth_states FOR ALL USING (false) WITH CHECK (false);
