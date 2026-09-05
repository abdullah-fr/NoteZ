-- Security hardening for authorization, server-only RPCs, and workspace scope.
-- This migration is additive and does not change authentication behavior.

-- These legacy SECURITY DEFINER helpers accept a user id as an argument. They
-- are used by server-side code only; leaving the default PUBLIC EXECUTE grant
-- would let an authenticated or anonymous caller mutate another user's data.
CREATE OR REPLACE FUNCTION public.increment_study_minutes(
  p_user_id UUID,
  p_minutes INTEGER
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Study progress updates are server-only';
  END IF;
  IF p_minutes IS NULL OR p_minutes < 1 OR p_minutes > 1440 THEN
    RAISE EXCEPTION 'Invalid study duration';
  END IF;

  INSERT INTO public.user_progress (
    user_id, total_study_minutes, xp, level, streak_days,
    exams_completed, flashcards_reviewed, quizzes_completed
  )
  VALUES (p_user_id, p_minutes, 0, 1, 0, 0, 0, 0)
  ON CONFLICT (user_id)
  DO UPDATE SET
    total_study_minutes = public.user_progress.total_study_minutes + EXCLUDED.total_study_minutes,
    updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.increment_study_minutes(UUID, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_study_minutes(UUID, INTEGER) TO service_role;

CREATE OR REPLACE FUNCTION public.upsert_usage_counter(
  p_user_id UUID,
  p_period DATE,
  p_field TEXT,
  p_limit INTEGER
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current INTEGER;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Usage updates are server-only';
  END IF;
  IF p_period IS NULL OR p_limit IS NULL OR p_limit < 1 OR p_limit > 1000000 THEN
    RAISE EXCEPTION 'Invalid usage counter parameters';
  END IF;
  IF p_field IS NULL OR p_field NOT IN (
    'ai_chat_messages_count',
    'exam_generations_count',
    'source_uploads_count'
  ) THEN
    RAISE EXCEPTION 'Invalid usage counter field';
  END IF;

  INSERT INTO public.usage_counters (user_id, period_start)
  VALUES (p_user_id, p_period)
  ON CONFLICT (user_id, period_start) DO NOTHING;

  EXECUTE format(
    'SELECT %I FROM public.usage_counters WHERE user_id = $1 AND period_start = $2 FOR UPDATE',
    p_field
  ) INTO v_current USING p_user_id, p_period;
  v_current := COALESCE(v_current, 0);

  IF v_current >= p_limit THEN
    RETURN json_build_object('allowed', false, 'current', v_current);
  END IF;

  EXECUTE format(
    'UPDATE public.usage_counters SET %I = %I + 1, updated_at = now()
     WHERE user_id = $1 AND period_start = $2',
    p_field, p_field
  ) USING p_user_id, p_period;

  RETURN json_build_object('allowed', true, 'current', v_current + 1);
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_usage_counter(UUID, DATE, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_usage_counter(UUID, DATE, TEXT, INTEGER) TO service_role;

-- A workspace leaderboard must never become a global directory of opted-in
-- users. The view owner can read the underlying rows, so scope the view itself
-- to workspaces in which the requesting user is a member.
DO $$
BEGIN
  IF to_regclass('public.workspace_leaderboard') IS NOT NULL
     AND to_regclass('public.workspace_members') IS NOT NULL THEN
    EXECUTE $view$
      CREATE OR REPLACE VIEW public.workspace_leaderboard AS
      SELECT
        wm.workspace_id,
        wm.user_id,
        p.full_name,
        COALESCE(up.total_study_minutes, 0) AS focus_minutes,
        COALESCE(up.streak_days, 0) AS streak_days
      FROM public.workspace_members wm
      JOIN public.profiles p ON p.user_id = wm.user_id
      LEFT JOIN public.user_progress up ON up.user_id = wm.user_id
      WHERE wm.leaderboard_opted_in = true
        AND public.is_workspace_member(wm.workspace_id, auth.uid())
    $view$;
    EXECUTE 'REVOKE ALL ON public.workspace_leaderboard FROM PUBLIC, anon';
    EXECUTE 'GRANT SELECT ON public.workspace_leaderboard TO authenticated';
  END IF;
END $$;

-- Keep the private upload bucket bounded even when a caller bypasses the
-- browser's file picker. HTML/SVG and other active document types are not
-- accepted because imported content must remain data, never executable web
-- content. The owner-prefix policies above still enforce account isolation.
DO $$
BEGIN
  IF to_regclass('storage.buckets') IS NOT NULL THEN
    EXECUTE $sql$
      UPDATE storage.buckets
      SET public = false,
          file_size_limit = 125829120,
          allowed_mime_types = ARRAY[
            'text/plain',
            'text/markdown',
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-powerpoint',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'image/png',
            'image/jpeg',
            'audio/mpeg',
            'audio/wav',
            'audio/x-wav',
            'audio/mp4',
            'audio/aac',
            'audio/ogg',
            'audio/flac',
            'video/mp4',
            'video/quicktime',
            'video/webm',
            'video/x-matroska'
          ]::text[]
      WHERE id = 'uploads'
    $sql$;
  END IF;
END $$;

-- Correct the argument order in the original class/deck policies. The helper
-- signature is (workspace_id, user_id); the old policies passed those values
-- in reverse, denying legitimate members while not expressing the intended
-- authorization rule.
-- RLS expressions run with the querying role's privileges. These helpers were
-- previously revoked from authenticated, which makes every policy that calls
-- them fail with permission denied. Keep them callable by authenticated so
-- RLS can evaluate them, but prevent a client from probing another user's
-- membership or role by passing a different user id.
CREATE OR REPLACE FUNCTION public.is_workspace_member(_workspace uuid, _user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspace_members
    WHERE workspace_id = _workspace
      AND user_id = _user
      AND (_user = auth.uid() OR auth.role() = 'service_role')
  )
$$;

CREATE OR REPLACE FUNCTION public.workspace_role_of(_workspace uuid, _user uuid)
RETURNS public.workspace_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.workspace_members
  WHERE workspace_id = _workspace
    AND user_id = _user
    AND (_user = auth.uid() OR auth.role() = 'service_role')
$$;

CREATE OR REPLACE FUNCTION public.can_edit_workspace(_workspace uuid, _user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.workspace_role_of(_workspace, _user) IN ('owner', 'admin', 'editor')
$$;

CREATE OR REPLACE FUNCTION public.can_admin_workspace(_workspace uuid, _user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.workspace_role_of(_workspace, _user) IN ('owner', 'admin')
$$;

REVOKE ALL ON FUNCTION public.is_workspace_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.workspace_role_of(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_edit_workspace(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_admin_workspace(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_workspace_member(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.workspace_role_of(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_edit_workspace(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_admin_workspace(uuid, uuid) TO authenticated, service_role;

DO $$
BEGIN
  IF to_regclass('public.class_shared_items') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Workspace members can view shared items" ON public.class_shared_items';
    EXECUTE $policy$
      CREATE POLICY "Workspace members can view shared items" ON public.class_shared_items
        FOR SELECT USING (public.is_workspace_member(workspace_id, auth.uid()))
    $policy$;
    EXECUTE 'DROP POLICY IF EXISTS "Admins can manage shared items" ON public.class_shared_items';
    EXECUTE $policy$
      CREATE POLICY "Admins can manage shared items" ON public.class_shared_items
        FOR ALL
        USING (public.can_admin_workspace(workspace_id, auth.uid()))
        WITH CHECK (public.can_admin_workspace(workspace_id, auth.uid()))
    $policy$;
  END IF;

  IF to_regclass('public.flashcard_decks') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Class decks visible to members" ON public.flashcard_decks';
    EXECUTE $policy$
      CREATE POLICY "Class decks visible to members" ON public.flashcard_decks
        FOR SELECT USING (
          visibility = 'class'
          AND workspace_id IS NOT NULL
          AND public.is_workspace_member(workspace_id, auth.uid())
        )
    $policy$;
  END IF;
END $$;

-- A user-owned row may reference a subject owned by another account. That
-- creates a cross-account destructive relationship because subject deletion
-- cascades to notes, flashcards, and quizzes. Keep the ownership check in a
-- server-owned helper so workspace editors can update a shared row without
-- being blocked by the private subject RLS policy.
CREATE OR REPLACE FUNCTION public.user_owns_subject(
  p_subject_id UUID,
  p_owner_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_subject_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.subjects
      WHERE id = p_subject_id AND user_id = p_owner_id
    )
$$;

REVOKE ALL ON FUNCTION public.user_owns_subject(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_owns_subject(UUID, UUID) TO authenticated, service_role;

-- A permissive workspace policy can authorize an editor to update a shared
-- row. The owner column must nevertheless be immutable: otherwise an editor
-- could retarget the row to another account by changing user_id in the same
-- UPDATE. Keep this invariant at the database boundary for every user-owned
-- table. workspace_members is intentionally excluded because its user_id is
-- changed by the invite-resolution workflow.
CREATE OR REPLACE FUNCTION public.prevent_user_id_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'The owner of a record cannot be changed';
  END IF;
  RETURN NEW;
END;
$$;

-- Workspace ownership is an authorization boundary too. A normal client must
-- not be able to retarget created_by: the workspace SELECT/member-insert
-- policies intentionally treat that column as an owner assertion. The NULL
-- transition is reserved for trusted account deletion, which uses
-- ON DELETE SET NULL.
CREATE OR REPLACE FUNCTION public.prevent_created_by_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    IF NEW.created_by IS NULL AND (auth.uid() IS NULL OR auth.role() = 'service_role') THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'The owner of a workspace cannot be changed';
  END IF;
  RETURN NEW;
END;
$$;

-- These functions are trigger/event-trigger entry points, not RPC APIs. The
-- original migrations left explicit client-role EXECUTE grants behind even
-- after removing the default PUBLIC grant. Keep them callable by the trigger
-- machinery while removing their PostgREST surface. Optional functions are
-- checked first so this migration also works on older installations.
DO $$
DECLARE
  function_name TEXT;
BEGIN
  FOREACH function_name IN ARRAY ARRAY[
    'add_workspace_owner',
    'cleanup_user_data_before_auth_delete',
    'handle_new_user',
    'resolve_workspace_invites',
    'rls_auto_enable',
    'prevent_user_id_change',
    'prevent_created_by_change'
  ] LOOP
    IF to_regprocedure(format('public.%I()', function_name)) IS NOT NULL THEN
      EXECUTE format(
        'REVOKE ALL ON FUNCTION public.%I() FROM PUBLIC, anon, authenticated',
        function_name
      );
    END IF;
  END LOOP;
END $$;

DO $$
BEGIN
  IF to_regclass('public.workspaces') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS enforce_workspace_owner_immutable ON public.workspaces';
    EXECUTE 'CREATE TRIGGER enforce_workspace_owner_immutable
      BEFORE UPDATE OF created_by ON public.workspaces
      FOR EACH ROW EXECUTE FUNCTION public.prevent_created_by_change()';
  END IF;

  IF to_regclass('public.class_shared_items') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS enforce_shared_item_creator_immutable ON public.class_shared_items';
    EXECUTE 'CREATE TRIGGER enforce_shared_item_creator_immutable
      BEFORE UPDATE OF created_by ON public.class_shared_items
      FOR EACH ROW EXECUTE FUNCTION public.prevent_created_by_change()';
  END IF;
END $$;

-- Keep this trigger helper deterministic if an untrusted schema is ever added
-- to a role's search_path.
DO $$
BEGIN
  IF to_regprocedure('public.set_updated_at()') IS NOT NULL THEN
    EXECUTE $function$
      CREATE OR REPLACE FUNCTION public.set_updated_at()
      RETURNS trigger
      LANGUAGE plpgsql
      SET search_path = public
      AS $body$
      BEGIN
        NEW.updated_at = now();
        RETURN NEW;
      END;
      $body$
    $function$;
  END IF;
END $$;

DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'profiles',
    'subjects',
    'notes',
    'study_tasks',
    'flashcards',
    'quizzes',
    'exam_results',
    'user_progress',
    'study_sessions',
    'sources',
    'chat_conversations',
    'chat_messages',
    'activities',
    'activity_checklist_items',
    'user_credits',
    'credit_transactions',
    'usage_counters',
    'streak_freeze_log',
    'folders',
    'folder_sections',
    'flashcard_decks',
    'notez_folders',
    'notez_trash',
    'notez_calendar_events',
    'notez_timer_data'
  ] LOOP
    IF to_regclass(format('public.%I', table_name)) IS NOT NULL THEN
      EXECUTE format(
        'DROP TRIGGER IF EXISTS enforce_user_id_immutable ON public.%I',
        table_name
      );
      EXECUTE format(
        'CREATE TRIGGER enforce_user_id_immutable
           BEFORE UPDATE OF user_id ON public.%I
           FOR EACH ROW
           EXECUTE FUNCTION public.prevent_user_id_change()',
        table_name
      );
    END IF;
  END LOOP;
END $$;

DROP POLICY IF EXISTS "Users can insert own notes" ON public.notes;
CREATE POLICY "Users can insert own notes" ON public.notes
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND public.user_owns_subject(subject_id, user_id)
    AND (workspace_id IS NULL OR public.is_workspace_member(workspace_id, auth.uid()))
  );

DROP POLICY IF EXISTS "Users can update own notes" ON public.notes;
CREATE POLICY "Users can update own notes" ON public.notes
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND public.user_owns_subject(subject_id, user_id)
    AND (workspace_id IS NULL OR public.is_workspace_member(workspace_id, auth.uid()))
  );

DROP POLICY IF EXISTS "notes_update_workspace" ON public.notes;
CREATE POLICY "notes_update_workspace" ON public.notes
  FOR UPDATE
  USING (workspace_id IS NOT NULL AND public.can_edit_workspace(workspace_id, auth.uid()))
  WITH CHECK (
    workspace_id IS NOT NULL
    AND public.can_edit_workspace(workspace_id, auth.uid())
    AND public.user_owns_subject(subject_id, user_id)
  );

DROP POLICY IF EXISTS "Users can insert own tasks" ON public.study_tasks;
CREATE POLICY "Users can insert own tasks" ON public.study_tasks
  FOR INSERT
  WITH CHECK (auth.uid() = user_id AND public.user_owns_subject(subject_id, user_id));

DROP POLICY IF EXISTS "Users can update own tasks" ON public.study_tasks;
CREATE POLICY "Users can update own tasks" ON public.study_tasks
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id AND public.user_owns_subject(subject_id, user_id));

DROP POLICY IF EXISTS "Users can insert own flashcards" ON public.flashcards;
CREATE POLICY "Users can insert own flashcards" ON public.flashcards
  FOR INSERT
  WITH CHECK (auth.uid() = user_id AND public.user_owns_subject(subject_id, user_id));

DROP POLICY IF EXISTS "Users can update own flashcards" ON public.flashcards;
CREATE POLICY "Users can update own flashcards" ON public.flashcards
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id AND public.user_owns_subject(subject_id, user_id));

DROP POLICY IF EXISTS "Users can insert own quizzes" ON public.quizzes;
CREATE POLICY "Users can insert own quizzes" ON public.quizzes
  FOR INSERT
  WITH CHECK (auth.uid() = user_id AND public.user_owns_subject(subject_id, user_id));

DROP POLICY IF EXISTS "Users can update own quizzes" ON public.quizzes;
CREATE POLICY "Users can update own quizzes" ON public.quizzes
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id AND public.user_owns_subject(subject_id, user_id));

DROP POLICY IF EXISTS "act_insert" ON public.activities;
CREATE POLICY "act_insert" ON public.activities
  FOR INSERT
  WITH CHECK (auth.uid() = user_id AND public.user_owns_subject(subject_id, user_id));

DROP POLICY IF EXISTS "act_update" ON public.activities;
CREATE POLICY "act_update" ON public.activities
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id AND public.user_owns_subject(subject_id, user_id));

-- Workspace attachment itself is also an ownership boundary. A forged
-- workspace_id on an insert could otherwise expose a user's row to that
-- workspace's members through the additive workspace SELECT policies.
DROP POLICY IF EXISTS "Users can insert own sources" ON public.sources;
CREATE POLICY "Users can insert own sources" ON public.sources
  FOR INSERT
  WITH CHECK (auth.uid() = user_id AND (workspace_id IS NULL OR public.is_workspace_member(workspace_id, auth.uid())));

DROP POLICY IF EXISTS "Users can update own sources" ON public.sources;
CREATE POLICY "Users can update own sources" ON public.sources
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id AND (workspace_id IS NULL OR public.is_workspace_member(workspace_id, auth.uid())));

DROP POLICY IF EXISTS "sources_update_workspace" ON public.sources;
CREATE POLICY "sources_update_workspace" ON public.sources
  FOR UPDATE
  USING (workspace_id IS NOT NULL AND public.can_edit_workspace(workspace_id, auth.uid()))
  WITH CHECK (workspace_id IS NOT NULL AND public.can_edit_workspace(workspace_id, auth.uid()));

DROP POLICY IF EXISTS "conv_insert" ON public.chat_conversations;
CREATE POLICY "conv_insert" ON public.chat_conversations
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND (workspace_id IS NULL OR public.is_workspace_member(workspace_id, auth.uid()))
    AND (
      source_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.sources s
        WHERE s.id = chat_conversations.source_id
          AND (
            s.user_id = auth.uid()
            OR (s.workspace_id IS NOT NULL AND public.is_workspace_member(s.workspace_id, auth.uid()))
          )
      )
    )
  );

DROP POLICY IF EXISTS "conv_update" ON public.chat_conversations;
CREATE POLICY "conv_update" ON public.chat_conversations
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND (workspace_id IS NULL OR public.is_workspace_member(workspace_id, auth.uid()))
    AND (
      source_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.sources s
        WHERE s.id = chat_conversations.source_id
          AND (
            s.user_id = auth.uid()
            OR (s.workspace_id IS NOT NULL AND public.is_workspace_member(s.workspace_id, auth.uid()))
          )
      )
    )
  );

-- Optional normalized folder tables are not present in every deployment.
-- Apply their parent ownership checks only when that schema exists.
DO $$
BEGIN
  IF to_regclass('public.folders') IS NOT NULL AND to_regclass('public.folder_sections') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Users own their folder sections" ON public.folder_sections';
    EXECUTE $policy$
      CREATE POLICY "Users own their folder sections" ON public.folder_sections
        FOR ALL
        USING (auth.uid() = user_id)
        WITH CHECK (
          auth.uid() = user_id
          AND EXISTS (
            SELECT 1 FROM public.folders f
            WHERE f.id = folder_id AND f.user_id = auth.uid()
          )
        )
    $policy$;
  END IF;
END $$;
