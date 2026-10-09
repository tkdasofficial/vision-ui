
-- Table to track which users have 2FA enabled
CREATE TABLE public.user_2fa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_2fa ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own 2fa" ON public.user_2fa FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own 2fa" ON public.user_2fa FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own 2fa" ON public.user_2fa FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- Function to check 2FA status by email (used before full auth, so SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.check_2fa_by_email(_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT u2.enabled FROM public.user_2fa u2
     JOIN public.profiles p ON p.id = u2.user_id
     WHERE p.email = _email
     LIMIT 1),
    false
  )
$$;
