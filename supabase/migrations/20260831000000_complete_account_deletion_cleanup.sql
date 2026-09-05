-- Complete account deletion cleanup for every user-owned table.
--
-- Relational cleanup below runs inside the auth.users delete transaction. The
-- Edge Function removes the user's Storage objects before starting that
-- transaction and fails closed if Storage cannot be enumerated or removed.

-- A deleted workspace owner must not delete a workspace that still contains
-- other members' shared material. Preserve those workspaces and remove the
-- deleted user's ownership reference instead.
DO $$
BEGIN
  IF to_regclass('public.workspaces') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.workspaces ALTER COLUMN created_by DROP NOT NULL';
    EXECUTE 'ALTER TABLE public.workspaces DROP CONSTRAINT IF EXISTS workspaces_created_by_fkey';
    EXECUTE 'ALTER TABLE public.workspaces
      ADD CONSTRAINT workspaces_created_by_fkey
      FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL NOT VALID';
  END IF;

  IF to_regclass('public.class_shared_items') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.class_shared_items ALTER COLUMN created_by DROP NOT NULL';
    EXECUTE 'ALTER TABLE public.class_shared_items DROP CONSTRAINT IF EXISTS class_shared_items_created_by_fkey';
    EXECUTE 'ALTER TABLE public.class_shared_items
      ADD CONSTRAINT class_shared_items_created_by_fkey
      FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL NOT VALID';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.cleanup_user_data_before_auth_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- Delete child rows explicitly so this remains correct even when a legacy
  -- installation is missing one of the newer cascade constraints.
  IF to_regclass('public.activity_checklist_items') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.activity_checklist_items WHERE user_id = $1' USING OLD.id;
  END IF;

  IF to_regclass('public.chat_messages') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.chat_messages m
      WHERE m.user_id = $1
         OR EXISTS (
           SELECT 1 FROM public.chat_conversations c
           WHERE c.id = m.conversation_id AND c.user_id = $1
         )' USING OLD.id;
  END IF;

  IF to_regclass('public.credit_transactions') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.credit_transactions WHERE user_id = $1' USING OLD.id;
  END IF;

  IF to_regclass('public.flashcards') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.flashcards WHERE user_id = $1' USING OLD.id;
  END IF;

  IF to_regclass('public.flashcard_decks') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.flashcard_decks WHERE user_id = $1' USING OLD.id;
  END IF;

  -- Remove workspaces that have no remaining real member. Shared workspaces
  -- with other members survive and are detached from the deleted owner by the
  -- ON DELETE SET NULL constraint above.
  IF to_regclass('public.workspaces') IS NOT NULL
     AND to_regclass('public.workspace_members') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.workspaces w
      WHERE w.created_by = $1
        AND NOT EXISTS (
          SELECT 1
          FROM public.workspace_members wm
          WHERE wm.workspace_id = w.id
            AND wm.user_id IS DISTINCT FROM $1
        )' USING OLD.id;
  END IF;

  IF to_regclass('public.workspace_members') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.workspace_members WHERE user_id = $1' USING OLD.id;
  END IF;

  IF to_regclass('public.activities') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.activities WHERE user_id = $1' USING OLD.id;
  END IF;

  IF to_regclass('public.chat_conversations') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.chat_conversations WHERE user_id = $1' USING OLD.id;
  END IF;

  IF to_regclass('public.sources') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.sources WHERE user_id = $1' USING OLD.id;
  END IF;

  IF to_regclass('public.exam_results') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.exam_results WHERE user_id = $1' USING OLD.id;
  END IF;

  IF to_regclass('public.user_progress') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.user_progress WHERE user_id = $1' USING OLD.id;
  END IF;

  IF to_regclass('public.study_sessions') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.study_sessions WHERE user_id = $1' USING OLD.id;
  END IF;

  IF to_regclass('public.quizzes') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.quizzes WHERE user_id = $1' USING OLD.id;
  END IF;

  IF to_regclass('public.notes') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.notes WHERE user_id = $1' USING OLD.id;
  END IF;

  IF to_regclass('public.study_tasks') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.study_tasks WHERE user_id = $1' USING OLD.id;
  END IF;

  IF to_regclass('public.subjects') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.subjects WHERE user_id = $1' USING OLD.id;
  END IF;

  IF to_regclass('public.folders') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.folders WHERE user_id = $1' USING OLD.id;
  END IF;

  IF to_regclass('public.folder_sections') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.folder_sections WHERE user_id = $1' USING OLD.id;
  END IF;

  IF to_regclass('public.notez_folders') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.notez_folders WHERE user_id = $1' USING OLD.id;
  END IF;

  IF to_regclass('public.notez_trash') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.notez_trash WHERE user_id = $1' USING OLD.id;
  END IF;

  IF to_regclass('public.notez_timer_data') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.notez_timer_data WHERE user_id = $1' USING OLD.id;
  END IF;

  IF to_regclass('public.notez_calendar_events') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.notez_calendar_events WHERE user_id = $1' USING OLD.id;
  END IF;

  IF to_regclass('public.notez_user_credits') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.notez_user_credits WHERE user_id = $1' USING OLD.id;
  END IF;

  IF to_regclass('public.user_credits') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.user_credits WHERE user_id = $1' USING OLD.id;
  END IF;

  IF to_regclass('public.usage_counters') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.usage_counters WHERE user_id = $1' USING OLD.id;
  END IF;

  IF to_regclass('public.streak_freeze_log') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.streak_freeze_log WHERE user_id = $1' USING OLD.id;
  END IF;

  IF to_regclass('public.profiles') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.profiles WHERE user_id = $1' USING OLD.id;
  END IF;

  RETURN OLD;
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_user_data_before_auth_delete() FROM PUBLIC;

DROP TRIGGER IF EXISTS cleanup_user_data_before_auth_delete ON auth.users;
CREATE TRIGGER cleanup_user_data_before_auth_delete
  BEFORE DELETE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.cleanup_user_data_before_auth_delete();
