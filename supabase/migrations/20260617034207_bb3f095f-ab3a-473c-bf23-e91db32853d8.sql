
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============ user_api_keys ============
CREATE TABLE IF NOT EXISTS public.user_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT 'default',
  encrypted_key BYTEA NOT NULL,
  key_hint TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'active',
  last_validated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider, label)
);

GRANT SELECT, DELETE ON public.user_api_keys TO authenticated;
GRANT ALL ON public.user_api_keys TO service_role;

ALTER TABLE public.user_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own keys" ON public.user_api_keys
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "users delete own keys" ON public.user_api_keys
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER trg_user_api_keys_updated
  BEFORE UPDATE ON public.user_api_keys
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ Plan gate ============
CREATE OR REPLACE FUNCTION public.can_use_own_keys(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE user_id = _user_id
      AND status = 'active'
      AND plan IN ('basic','pro','business')
  );
$$;

-- ============ Encryption RPCs (service_role only) ============
CREATE OR REPLACE FUNCTION public.store_user_api_key(
  _user_id UUID, _provider TEXT, _label TEXT,
  _plaintext TEXT, _secret TEXT, _metadata JSONB
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog
AS $$
DECLARE _id UUID; _hint TEXT;
BEGIN
  _hint := '••••' || RIGHT(_plaintext, 4);
  INSERT INTO public.user_api_keys (user_id, provider, label, encrypted_key, key_hint, metadata, status, last_validated_at)
  VALUES (_user_id, _provider, COALESCE(NULLIF(_label,''),'default'),
          pgp_sym_encrypt(_plaintext, _secret), _hint, COALESCE(_metadata,'{}'::jsonb), 'active', now())
  ON CONFLICT (user_id, provider, label) DO UPDATE
    SET encrypted_key = EXCLUDED.encrypted_key,
        key_hint = EXCLUDED.key_hint,
        metadata = EXCLUDED.metadata,
        status = 'active',
        last_validated_at = now(),
        updated_at = now()
  RETURNING id INTO _id;
  RETURN _id;
END $$;

REVOKE ALL ON FUNCTION public.store_user_api_key(UUID,TEXT,TEXT,TEXT,TEXT,JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.store_user_api_key(UUID,TEXT,TEXT,TEXT,TEXT,JSONB) TO service_role;

CREATE OR REPLACE FUNCTION public.get_user_api_key(
  _user_id UUID, _provider TEXT, _secret TEXT
) RETURNS TABLE(id UUID, plaintext TEXT, metadata JSONB, label TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog
AS $$
BEGIN
  RETURN QUERY
    SELECT k.id, pgp_sym_decrypt(k.encrypted_key, _secret), k.metadata, k.label
    FROM public.user_api_keys k
    WHERE k.user_id = _user_id AND k.provider = _provider AND k.status = 'active'
    ORDER BY k.last_validated_at DESC NULLS LAST
    LIMIT 1;
END $$;

REVOKE ALL ON FUNCTION public.get_user_api_key(UUID,TEXT,TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_api_key(UUID,TEXT,TEXT) TO service_role;
