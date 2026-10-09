
ALTER TABLE public.user_2fa ADD COLUMN IF NOT EXISTS method text NOT NULL DEFAULT 'none';
UPDATE public.user_2fa SET method = CASE WHEN enabled THEN 'email' ELSE 'none' END;
