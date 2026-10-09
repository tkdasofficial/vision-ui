-- Story Creation feature

-- 1) Extend chat_sessions for story mode
ALTER TABLE public.chat_sessions
  ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'chat',
  ADD COLUMN IF NOT EXISTS story_state JSONB NOT NULL DEFAULT '{}'::jsonb;

-- 2) story_projects table
CREATE TABLE IF NOT EXISTS public.story_projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  session_id UUID,
  title TEXT,
  topic TEXT,
  category TEXT,
  audience TEXT,
  language TEXT DEFAULT 'English',
  length TEXT,
  status TEXT NOT NULL DEFAULT 'collecting',
  script TEXT,
  audio_url TEXT,
  analysis JSONB NOT NULL DEFAULT '{}'::jsonb,
  characters JSONB NOT NULL DEFAULT '[]'::jsonb,
  scenes JSONB NOT NULL DEFAULT '[]'::jsonb,
  prompts JSONB NOT NULL DEFAULT '[]'::jsonb,
  generation_mode TEXT DEFAULT 'batch',
  progress JSONB NOT NULL DEFAULT '{}'::jsonb,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.story_projects TO authenticated;
GRANT ALL ON public.story_projects TO service_role;

ALTER TABLE public.story_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own story projects"
ON public.story_projects FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS story_projects_user_idx ON public.story_projects(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS story_projects_session_idx ON public.story_projects(session_id);

CREATE TRIGGER story_projects_updated_at
  BEFORE UPDATE ON public.story_projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Realtime
ALTER TABLE public.story_projects REPLICA IDENTITY FULL;
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.story_projects;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
