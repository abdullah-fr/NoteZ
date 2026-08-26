-- ============================================================
-- FULL MIGRATION — paste this into Supabase SQL Editor
-- Project: lnbfgvuweumzzxezoqcn
-- Run once on a fresh project
-- ============================================================

-- ============================================================
-- MIGRATION 1: Core tables (profiles, subjects, notes, tasks,
--              flashcards, quizzes, triggers)
-- ============================================================

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

CREATE TABLE public.subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT 'book',
  color TEXT DEFAULT '#8B5CF6',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own subjects" ON public.subjects FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own subjects" ON public.subjects FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own subjects" ON public.subjects FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own subjects" ON public.subjects FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE public.notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own notes" ON public.notes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own notes" ON public.notes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own notes" ON public.notes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own notes" ON public.notes FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE public.study_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  due_date DATE NOT NULL,
  completed BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);
ALTER TABLE public.study_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own tasks" ON public.study_tasks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own tasks" ON public.study_tasks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own tasks" ON public.study_tasks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own tasks" ON public.study_tasks FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE public.flashcards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);
ALTER TABLE public.flashcards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own flashcards" ON public.flashcards FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own flashcards" ON public.flashcards FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own flashcards" ON public.flashcards FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own flashcards" ON public.flashcards FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE public.quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  options JSONB NOT NULL,
  correct_answer INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own quizzes" ON public.quizzes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own quizzes" ON public.quizzes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own quizzes" ON public.quizzes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own quizzes" ON public.quizzes FOR DELETE USING (auth.uid() = user_id);

-- Shared utility functions & triggers
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_notes_updated_at
  BEFORE UPDATE ON public.notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- MIGRATION 2: exam_results, user_progress, study_sessions
-- ============================================================

CREATE TABLE public.exam_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  specialization TEXT,
  score INTEGER NOT NULL DEFAULT 0,
  total_questions INTEGER NOT NULL DEFAULT 0,
  difficulty TEXT NOT NULL DEFAULT 'medium',
  questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.exam_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own exam results" ON public.exam_results FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own exam results" ON public.exam_results FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own exam results" ON public.exam_results FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE public.user_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  xp INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 1,
  streak_days INTEGER NOT NULL DEFAULT 0,
  last_study_date DATE,
  total_study_minutes INTEGER NOT NULL DEFAULT 0,
  exams_completed INTEGER NOT NULL DEFAULT 0,
  flashcards_reviewed INTEGER NOT NULL DEFAULT 0,
  quizzes_completed INTEGER NOT NULL DEFAULT 0,
  strong_areas JSONB NOT NULL DEFAULT '[]'::jsonb,
  weak_areas JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.user_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own progress" ON public.user_progress FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own progress" ON public.user_progress FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own progress" ON public.user_progress FOR UPDATE USING (auth.uid() = user_id);

CREATE TABLE public.study_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL,
  subject TEXT,
  duration_minutes INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ended_at TIMESTAMP WITH TIME ZONE
);
ALTER TABLE public.study_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own sessions" ON public.study_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own sessions" ON public.study_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own sessions" ON public.study_sessions FOR UPDATE USING (auth.uid() = user_id);

CREATE TRIGGER update_user_progress_updated_at
  BEFORE UPDATE ON public.user_progress
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- MIGRATION 3: Realtime publications
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.study_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.exam_results;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_progress;

-- ============================================================
-- MIGRATION 4: sources table + storage bucket
-- ============================================================

CREATE TABLE public.sources (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'text',
  file_path TEXT,
  source_url TEXT,
  extracted_text TEXT,
  summary TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  error TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own sources" ON public.sources FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own sources" ON public.sources FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own sources" ON public.sources FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own sources" ON public.sources FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER set_sources_updated_at
  BEFORE UPDATE ON public.sources
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_sources_user_created ON public.sources(user_id, created_at DESC);

INSERT INTO storage.buckets (id, name, public)
VALUES ('uploads', 'uploads', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can view own uploads"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'uploads' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload to own folder"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'uploads' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update own uploads"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'uploads' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own uploads"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'uploads' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ============================================================
-- MIGRATION 5: chat_conversations + chat_messages
-- ============================================================

CREATE TABLE IF NOT EXISTS public.chat_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL DEFAULT 'New chat',
  mode text NOT NULL DEFAULT 'tutor',
  source_id uuid REFERENCES public.sources(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "conv_select" ON public.chat_conversations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "conv_insert" ON public.chat_conversations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "conv_update" ON public.chat_conversations FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "conv_delete" ON public.chat_conversations FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('user','assistant','system')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "msg_select" ON public.chat_messages FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "msg_insert" ON public.chat_messages FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "msg_delete" ON public.chat_messages FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS chat_messages_conversation_idx ON public.chat_messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS chat_conversations_user_idx ON public.chat_conversations(user_id, updated_at DESC);

CREATE TRIGGER update_chat_conversations_updated_at
  BEFORE UPDATE ON public.chat_conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- MIGRATION 6: workspaces + workspace_members + collaboration
-- ============================================================

DO $$ BEGIN
  CREATE TYPE public.workspace_role AS ENUM ('owner','admin','editor','viewer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.workspace_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role public.workspace_role NOT NULL DEFAULT 'viewer',
  invited_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id)
);
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_workspace_member(_workspace uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.workspace_members WHERE workspace_id = _workspace AND user_id = _user)
$$;

CREATE OR REPLACE FUNCTION public.workspace_role_of(_workspace uuid, _user uuid)
RETURNS public.workspace_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.workspace_members WHERE workspace_id = _workspace AND user_id = _user
$$;

CREATE OR REPLACE FUNCTION public.can_edit_workspace(_workspace uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.workspace_role_of(_workspace, _user) IN ('owner','admin','editor')
$$;

CREATE OR REPLACE FUNCTION public.can_admin_workspace(_workspace uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.workspace_role_of(_workspace, _user) IN ('owner','admin')
$$;

CREATE POLICY "ws_select_member" ON public.workspaces FOR SELECT
  USING (public.is_workspace_member(id, auth.uid()) OR created_by = auth.uid());
CREATE POLICY "ws_insert_self" ON public.workspaces FOR INSERT
  WITH CHECK (created_by = auth.uid());
CREATE POLICY "ws_update_admin" ON public.workspaces FOR UPDATE
  USING (public.can_admin_workspace(id, auth.uid()));
CREATE POLICY "ws_delete_owner" ON public.workspaces FOR DELETE
  USING (public.workspace_role_of(id, auth.uid()) = 'owner');

CREATE POLICY "wm_select_member" ON public.workspace_members FOR SELECT
  USING (public.is_workspace_member(workspace_id, auth.uid()));
CREATE POLICY "wm_insert_admin_or_self_owner" ON public.workspace_members FOR INSERT
  WITH CHECK (
    public.can_admin_workspace(workspace_id, auth.uid())
    OR (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.created_by = auth.uid()))
  );
CREATE POLICY "wm_update_admin" ON public.workspace_members FOR UPDATE
  USING (public.can_admin_workspace(workspace_id, auth.uid()));
CREATE POLICY "wm_delete_admin_or_self" ON public.workspace_members FOR DELETE
  USING (public.can_admin_workspace(workspace_id, auth.uid()) OR user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.add_workspace_owner()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'owner')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_add_workspace_owner ON public.workspaces;
CREATE TRIGGER trg_add_workspace_owner
  AFTER INSERT ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.add_workspace_owner();

ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL;
ALTER TABLE public.sources ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL;
ALTER TABLE public.chat_conversations ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL;

CREATE POLICY "notes_select_workspace" ON public.notes FOR SELECT
  USING (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id, auth.uid()));
CREATE POLICY "notes_update_workspace" ON public.notes FOR UPDATE
  USING (workspace_id IS NOT NULL AND public.can_edit_workspace(workspace_id, auth.uid()));

CREATE POLICY "sources_select_workspace" ON public.sources FOR SELECT
  USING (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id, auth.uid()));
CREATE POLICY "sources_update_workspace" ON public.sources FOR UPDATE
  USING (workspace_id IS NOT NULL AND public.can_edit_workspace(workspace_id, auth.uid()));

CREATE POLICY "chat_select_workspace" ON public.chat_conversations FOR SELECT
  USING (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id, auth.uid()));
CREATE POLICY "chat_msg_select_workspace" ON public.chat_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_conversations c
      WHERE c.id = chat_messages.conversation_id
        AND c.workspace_id IS NOT NULL
        AND public.is_workspace_member(c.workspace_id, auth.uid())
    )
  );

CREATE OR REPLACE FUNCTION public.resolve_workspace_invites()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.workspace_members
    SET user_id = NEW.id, invited_email = NULL
    WHERE invited_email = NEW.email AND user_id = '00000000-0000-0000-0000-000000000000';
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_resolve_invites ON auth.users;
CREATE TRIGGER trg_resolve_invites
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.resolve_workspace_invites();

-- ============================================================
-- MIGRATION 7: Realtime security lockdown
-- ============================================================

-- Grant to authenticated only (needed for RLS policies on workspace tables)
GRANT EXECUTE ON FUNCTION public.is_workspace_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_edit_workspace(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_admin_workspace(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.workspace_role_of(uuid, uuid) TO authenticated;

-- Revoke from anon only
REVOKE EXECUTE ON FUNCTION public.is_workspace_member(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_edit_workspace(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_admin_workspace(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.workspace_role_of(uuid, uuid) FROM anon;

DROP POLICY IF EXISTS "realtime_authenticated_read" ON realtime.messages;
DROP POLICY IF EXISTS "realtime_authenticated_write" ON realtime.messages;

CREATE POLICY "realtime_authenticated_read"
  ON realtime.messages FOR SELECT TO authenticated
  USING (
    realtime.topic() = 'user:' || auth.uid()::text
    OR (
      realtime.topic() LIKE 'workspace:%'
      AND public.is_workspace_member(substring(realtime.topic() FROM 11)::uuid, auth.uid())
    )
  );

CREATE POLICY "realtime_authenticated_write"
  ON realtime.messages FOR INSERT TO authenticated
  WITH CHECK (
    realtime.topic() = 'user:' || auth.uid()::text
    OR (
      realtime.topic() LIKE 'workspace:%'
      AND public.is_workspace_member(substring(realtime.topic() FROM 11)::uuid, auth.uid())
    )
  );

-- ============================================================
-- MIGRATION 8: activities + activity_checklist_items
-- ============================================================

CREATE TABLE public.activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  subject_id UUID,
  subject TEXT,
  title TEXT NOT NULL,
  description TEXT,
  progress INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "act_select" ON public.activities FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "act_insert" ON public.activities FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "act_update" ON public.activities FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "act_delete" ON public.activities FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER activities_updated_at BEFORE UPDATE ON public.activities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.activity_checklist_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  activity_id UUID NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  label TEXT NOT NULL,
  done BOOLEAN NOT NULL DEFAULT false,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.activity_checklist_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "aci_select" ON public.activity_checklist_items FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "aci_insert" ON public.activity_checklist_items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "aci_update" ON public.activity_checklist_items FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "aci_delete" ON public.activity_checklist_items FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_activities_user ON public.activities(user_id);
CREATE INDEX idx_aci_activity ON public.activity_checklist_items(activity_id);

-- ============================================================
-- MIGRATION 9: Centralized Credits & Subscription System
-- ============================================================

CREATE TABLE IF NOT EXISTS public.user_credits (
  user_id             UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance             INTEGER NOT NULL DEFAULT 150 CHECK (balance >= 0),
  allowance           INTEGER NOT NULL DEFAULT 150 CHECK (allowance >= 0),
  tier                TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'pro_student', 'pro_scholar', 'team')),
  period_start        TIMESTAMPTZ NOT NULL DEFAULT now(),
  period_end          TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.credit_transactions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount              INTEGER NOT NULL,
  action              TEXT NOT NULL,
  description         TEXT,
  status              TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'refunded', 'failed')),
  balance_after       INTEGER NOT NULL,
  metadata            JSONB DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_credits' AND policyname = 'Users can view own credits'
  ) THEN
    CREATE POLICY "Users can view own credits" ON public.user_credits
      FOR SELECT USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'credit_transactions' AND policyname = 'Users can view own credit transactions'
  ) THEN
    CREATE POLICY "Users can view own credit transactions" ON public.credit_transactions
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_user_credits_user_id ON public.user_credits(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_created ON public.credit_transactions(user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.ensure_user_credits(p_user_id UUID)
RETURNS public.user_credits
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rec public.user_credits;
  v_interval INTERVAL;
  v_allowance INTEGER;
BEGIN
  SELECT * INTO v_rec FROM public.user_credits WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    v_allowance := 150;
    v_interval := INTERVAL '7 days';

    INSERT INTO public.user_credits (user_id, balance, allowance, tier, period_start, period_end)
    VALUES (p_user_id, v_allowance, v_allowance, 'free', now(), now() + v_interval)
    ON CONFLICT (user_id) DO UPDATE SET updated_at = now()
    RETURNING * INTO v_rec;

    INSERT INTO public.credit_transactions (user_id, amount, action, description, status, balance_after)
    VALUES (p_user_id, v_allowance, 'initial_grant', 'Welcome to NoteZ (Weekly Free Allowance)', 'success', v_allowance);
  END IF;

  IF v_rec.tier = 'free' THEN
    v_interval := INTERVAL '7 days';
    v_allowance := 150;
  ELSIF v_rec.tier = 'pro_student' THEN
    v_interval := INTERVAL '30 days';
    v_allowance := 5000;
  ELSIF v_rec.tier = 'pro_scholar' THEN
    v_interval := INTERVAL '30 days';
    v_allowance := 15000;
  ELSE
    v_interval := INTERVAL '30 days';
    v_allowance := 50000;
  END IF;

  IF now() >= v_rec.period_end THEN
    UPDATE public.user_credits
    SET balance = v_allowance,
        allowance = v_allowance,
        period_start = now(),
        period_end = now() + v_interval,
        updated_at = now()
    WHERE user_id = p_user_id
    RETURNING * INTO v_rec;

    INSERT INTO public.credit_transactions (user_id, amount, action, description, status, balance_after)
    VALUES (p_user_id, v_allowance, 'credit_refill', 'Credit allowance refill', 'success', v_rec.balance);
  END IF;

  RETURN v_rec;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_and_deduct_credits(
  p_user_id     UUID,
  p_amount      INTEGER,
  p_action      TEXT,
  p_description TEXT DEFAULT '',
  p_metadata    JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_credit_rec public.user_credits;
  v_new_balance INTEGER;
BEGIN
  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('success', true, 'balance_after', 0, 'deducted', 0);
  END IF;

  v_credit_rec := public.ensure_user_credits(p_user_id);

  IF v_credit_rec.balance < p_amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'INSUFFICIENT_CREDITS',
      'balance', v_credit_rec.balance,
      'required', p_amount,
      'reset_date', v_credit_rec.period_end,
      'tier', v_credit_rec.tier
    );
  END IF;

  v_new_balance := v_credit_rec.balance - p_amount;

  UPDATE public.user_credits
  SET balance = v_new_balance, updated_at = now()
  WHERE user_id = p_user_id;

  INSERT INTO public.credit_transactions (
    user_id, amount, action, description, status, balance_after, metadata
  ) VALUES (
    p_user_id, -p_amount, p_action, p_description, 'success', v_new_balance, p_metadata
  );

  RETURN jsonb_build_object(
    'success', true,
    'balance_after', v_new_balance,
    'deducted', p_amount,
    'reset_date', v_credit_rec.period_end
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.refund_credits(
  p_user_id     UUID,
  p_amount      INTEGER,
  p_action      TEXT,
  p_reason      TEXT DEFAULT 'Operation failed',
  p_metadata    JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_balance INTEGER;
BEGIN
  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('success', true);
  END IF;

  UPDATE public.user_credits
  SET balance = balance + p_amount, updated_at = now()
  WHERE user_id = p_user_id
  RETURNING balance INTO v_new_balance;

  INSERT INTO public.credit_transactions (
    user_id, amount, action, description, status, balance_after, metadata
  ) VALUES (
    p_user_id, p_amount, 'refund', 'Refund: ' || p_reason, 'refunded', COALESCE(v_new_balance, p_amount), p_metadata
  );

  RETURN jsonb_build_object('success', true, 'balance_after', v_new_balance);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_user_credits_summary(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_credit_rec public.user_credits;
  v_tx_json JSONB;
  v_used_this_period INTEGER;
BEGIN
  v_credit_rec := public.ensure_user_credits(p_user_id);

  SELECT COALESCE(ABS(SUM(amount)), 0) INTO v_used_this_period
  FROM public.credit_transactions
  WHERE user_id = p_user_id
    AND amount < 0
    AND status = 'success'
    AND created_at >= v_credit_rec.period_start;

  SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) INTO v_tx_json
  FROM (
    SELECT id, user_id, amount, action, description, status, balance_after, created_at
    FROM public.credit_transactions
    WHERE user_id = p_user_id
    ORDER BY created_at DESC
    LIMIT 50
  ) t;

  RETURN jsonb_build_object(
    'balance', v_credit_rec.balance,
    'allowance', v_credit_rec.allowance,
    'used_this_period', v_used_this_period,
    'tier', v_credit_rec.tier,
    'period_start', v_credit_rec.period_start,
    'period_end', v_credit_rec.period_end,
    'transactions', v_tx_json
  );
END;
$$;

