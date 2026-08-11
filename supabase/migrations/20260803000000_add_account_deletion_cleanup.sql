-- Keep account removal atomic: this trigger runs inside auth.users deletion.
-- If any statement fails, Postgres rolls back the auth deletion and all data deletion.
CREATE OR REPLACE FUNCTION public.cleanup_user_data_before_auth_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- Tables without a foreign key to auth.users need explicit cleanup.
  DELETE FROM public.activity_checklist_items WHERE user_id = OLD.id;
  DELETE FROM public.activities WHERE user_id = OLD.id;
  DELETE FROM public.chat_messages WHERE user_id = OLD.id;
  DELETE FROM public.chat_conversations WHERE user_id = OLD.id;
  DELETE FROM public.sources WHERE user_id = OLD.id;
  DELETE FROM public.workspace_members WHERE user_id = OLD.id;

  -- Delete each user-owned table explicitly. Foreign-key cascades on auth.users
  -- provide a final safeguard for these rows and their related records.
  DELETE FROM public.exam_results WHERE user_id = OLD.id;
  DELETE FROM public.user_progress WHERE user_id = OLD.id;
  DELETE FROM public.study_sessions WHERE user_id = OLD.id;
  DELETE FROM public.flashcards WHERE user_id = OLD.id;
  DELETE FROM public.quizzes WHERE user_id = OLD.id;
  DELETE FROM public.notes WHERE user_id = OLD.id;
  DELETE FROM public.study_tasks WHERE user_id = OLD.id;
  DELETE FROM public.subjects WHERE user_id = OLD.id;
  DELETE FROM public.profiles WHERE user_id = OLD.id;

  RETURN OLD;
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_user_data_before_auth_delete() FROM PUBLIC;

DROP TRIGGER IF EXISTS cleanup_user_data_before_auth_delete ON auth.users;
CREATE TRIGGER cleanup_user_data_before_auth_delete
  BEFORE DELETE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.cleanup_user_data_before_auth_delete();
