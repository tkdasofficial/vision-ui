-- Chat sessions table
CREATE TABLE public.chat_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'New Chat',
  preview text NOT NULL DEFAULT '',
  tool_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Chat messages table
CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL DEFAULT '',
  image_url text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_chat_sessions_user_id ON public.chat_sessions(user_id);
CREATE INDEX idx_chat_sessions_created_at ON public.chat_sessions(created_at DESC);
CREATE INDEX idx_chat_messages_session_id ON public.chat_messages(session_id);
CREATE INDEX idx_chat_messages_created_at ON public.chat_messages(created_at);

-- RLS policies for chat_sessions
CREATE POLICY "Users can view own sessions"
  ON public.chat_sessions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own sessions"
  ON public.chat_sessions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own sessions"
  ON public.chat_sessions FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own sessions"
  ON public.chat_sessions FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- RLS policies for chat_messages
CREATE POLICY "Users can view own messages"
  ON public.chat_messages FOR SELECT
  TO authenticated
  USING (
    session_id IN (
      SELECT id FROM public.chat_sessions WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own messages"
  ON public.chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    session_id IN (
      SELECT id FROM public.chat_sessions WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own messages"
  ON public.chat_messages FOR DELETE
  TO authenticated
  USING (
    session_id IN (
      SELECT id FROM public.chat_sessions WHERE user_id = auth.uid()
    )
  );

-- Auto-cleanup function: delete sessions older than 7 days
CREATE OR REPLACE FUNCTION public.cleanup_old_chat_sessions()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.chat_sessions
  WHERE created_at < now() - interval '7 days';
$$;