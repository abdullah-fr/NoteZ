-- Harden account isolation after the client storage/query audit.
--
-- All private study data remains owner-scoped. Workspaces are the one
-- intentional exception: a member may read data explicitly attached to a
-- workspace, but that does not make private rows globally readable.

-- Keep RLS enabled even if a table was recreated while applying migrations.
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.study_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.flashcards ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.exam_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.study_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.activity_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.folder_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.notez_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.notez_trash ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.notez_timer_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.notez_calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.notez_user_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.usage_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.streak_freeze_log ENABLE ROW LEVEL SECURITY;

-- Enforce the account boundary at the database relationship level for tables
-- that were originally created without an auth.users foreign key. NOT VALID
-- keeps existing legacy rows deployable while enforcing ownership for every
-- new or updated row. The conditional blocks also keep this migration safe on
-- installations that do not yet have an optional table.
DO $$
BEGIN
  IF to_regclass('public.sources') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'public.sources'::regclass
        AND conname = 'sources_user_id_fkey'
    ) THEN
    ALTER TABLE public.sources
      ADD CONSTRAINT sources_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE NOT VALID;
  END IF;

  IF to_regclass('public.chat_conversations') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'public.chat_conversations'::regclass
        AND conname = 'chat_conversations_user_id_fkey'
    ) THEN
    ALTER TABLE public.chat_conversations
      ADD CONSTRAINT chat_conversations_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE NOT VALID;
  END IF;

  IF to_regclass('public.chat_messages') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'public.chat_messages'::regclass
        AND conname = 'chat_messages_user_id_fkey'
    ) THEN
    ALTER TABLE public.chat_messages
      ADD CONSTRAINT chat_messages_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE NOT VALID;
  END IF;

  IF to_regclass('public.activities') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'public.activities'::regclass
        AND conname = 'activities_user_id_fkey'
    ) THEN
    ALTER TABLE public.activities
      ADD CONSTRAINT activities_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE NOT VALID;
  END IF;

  IF to_regclass('public.activity_checklist_items') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'public.activity_checklist_items'::regclass
        AND conname = 'activity_checklist_items_user_id_fkey'
    ) THEN
    ALTER TABLE public.activity_checklist_items
      ADD CONSTRAINT activity_checklist_items_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE NOT VALID;
  END IF;

  IF to_regclass('public.workspaces') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'public.workspaces'::regclass
        AND conname = 'workspaces_created_by_fkey'
    ) THEN
    ALTER TABLE public.workspaces
      ADD CONSTRAINT workspaces_created_by_fkey
      FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

-- A message must belong to a conversation the current user can access. The
-- original policy only checked message.user_id, which allowed a caller who
-- knew another conversation UUID to insert their own message into it.
DROP POLICY IF EXISTS "msg_insert" ON public.chat_messages;
CREATE POLICY "msg_insert" ON public.chat_messages
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.chat_conversations c
      WHERE c.id = chat_messages.conversation_id
        AND (
          c.user_id = auth.uid()
          OR (
            c.workspace_id IS NOT NULL
            AND public.is_workspace_member(c.workspace_id, auth.uid())
          )
        )
    )
  );

-- Prevent a conversation from being created or retargeted to a source owned
-- by another account. Explicit workspace membership is allowed for shared
-- sources, matching the existing workspace read model.
DROP POLICY IF EXISTS "conv_insert" ON public.chat_conversations;
CREATE POLICY "conv_insert" ON public.chat_conversations
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND (
      source_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.sources s
        WHERE s.id = chat_conversations.source_id
          AND (
            s.user_id = auth.uid()
            OR (
              s.workspace_id IS NOT NULL
              AND public.is_workspace_member(s.workspace_id, auth.uid())
            )
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
    AND (
      source_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.sources s
        WHERE s.id = chat_conversations.source_id
          AND (
            s.user_id = auth.uid()
            OR (
              s.workspace_id IS NOT NULL
              AND public.is_workspace_member(s.workspace_id, auth.uid())
            )
          )
      )
    )
  );

-- Make the ownership check explicit on the folder blob tables. The unique
-- user_id constraints ensure one isolated row per account; these policies
-- ensure that row can only be read or written by its owner.
DROP POLICY IF EXISTS "Users can update their own folders" ON public.notez_folders;
CREATE POLICY "Users can update their own folders" ON public.notez_folders
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own trash" ON public.notez_trash;
CREATE POLICY "Users can update their own trash" ON public.notez_trash
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own timer data" ON public.notez_timer_data;
CREATE POLICY "Users can update their own timer data" ON public.notez_timer_data
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own calendar events" ON public.notez_calendar_events;
CREATE POLICY "Users can update their own calendar events" ON public.notez_calendar_events
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- These policies already existed, but make the normalized folder tables'
-- ownership boundary explicit when that optional schema is installed. Some
-- deployments use only the JSON blob tables above, so do not reference
-- missing normalized tables directly from the migration.
DO $$
BEGIN
  IF to_regclass('public.folders') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Users own their folders" ON public.folders';
    EXECUTE $policy$
      CREATE POLICY "Users own their folders" ON public.folders
        FOR ALL
        USING (auth.uid() = user_id)
        WITH CHECK (auth.uid() = user_id)
    $policy$;
  END IF;

  IF to_regclass('public.folder_sections') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Users own their folder sections" ON public.folder_sections';
    EXECUTE $policy$
      CREATE POLICY "Users own their folder sections" ON public.folder_sections
        FOR ALL
        USING (auth.uid() = user_id)
        WITH CHECK (auth.uid() = user_id)
    $policy$;
  END IF;
END $$;

-- A checklist row must belong to an activity owned by the same account. A
-- user_id-only policy would still permit a forged item to point at another
-- user's activity UUID.
DROP POLICY IF EXISTS "aci_insert" ON public.activity_checklist_items;
CREATE POLICY "aci_insert" ON public.activity_checklist_items
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.activities a
      WHERE a.id = activity_checklist_items.activity_id
        AND a.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "aci_update" ON public.activity_checklist_items;
CREATE POLICY "aci_update" ON public.activity_checklist_items
  FOR UPDATE
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.activities a
      WHERE a.id = activity_checklist_items.activity_id
        AND a.user_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.activities a
      WHERE a.id = activity_checklist_items.activity_id
        AND a.user_id = auth.uid()
    )
  );
