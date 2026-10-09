
-- Background tasks table for persistent server-side job execution
CREATE TABLE public.background_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  session_id UUID REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
  task_type TEXT NOT NULL DEFAULT 'chat',
  status TEXT NOT NULL DEFAULT 'pending',
  input JSONB NOT NULL DEFAULT '{}'::jsonb,
  result JSONB,
  progress INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.background_tasks ENABLE ROW LEVEL SECURITY;

-- Users can view their own tasks
CREATE POLICY "Users can view own tasks" ON public.background_tasks
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Users can insert own tasks
CREATE POLICY "Users can insert own tasks" ON public.background_tasks
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can update own tasks (for cancellation)
CREATE POLICY "Users can update own tasks" ON public.background_tasks
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- Enable realtime for this table
ALTER PUBLICATION supabase_realtime ADD TABLE public.background_tasks;
