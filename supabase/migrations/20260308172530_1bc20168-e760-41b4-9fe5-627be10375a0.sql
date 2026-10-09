
-- Update handle_new_user to also grant admin to super-copilot@outlook.com
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')
  );

  IF NEW.email IN ('avzio@outlook.com', 'super-copilot@outlook.com') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT DO NOTHING;
  END IF;

  INSERT INTO public.subscriptions (user_id, plan, status) VALUES (NEW.id, 'free', 'active');

  RETURN NEW;
END;
$function$;

-- Also grant admin to existing super-copilot@outlook.com user if they already exist
INSERT INTO public.user_roles (user_id, role)
SELECT p.id, 'admin'
FROM public.profiles p
WHERE p.email = 'super-copilot@outlook.com'
  AND NOT EXISTS (
    SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.id AND ur.role = 'admin'
  );

-- Add RLS policy for admins to view all background_tasks
CREATE POLICY "Admins can view all tasks" ON public.background_tasks
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Add RLS policy for admins to view all chat_sessions
CREATE POLICY "Admins can view all sessions" ON public.chat_sessions
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Add RLS policy for admins to view all chat_messages
CREATE POLICY "Admins can view all messages" ON public.chat_messages
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Admins can delete any chat session
CREATE POLICY "Admins can delete any session" ON public.chat_sessions
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Admins can update background tasks
CREATE POLICY "Admins can update all tasks" ON public.background_tasks
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
