
DROP FUNCTION IF EXISTS public.check_2fa_by_email(text);

CREATE FUNCTION public.check_2fa_by_email(_email text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT u2.method FROM public.user_2fa u2
     JOIN public.profiles p ON p.id = u2.user_id
     WHERE p.email = _email AND u2.enabled = true
     LIMIT 1),
    'none'
  )
$$;
