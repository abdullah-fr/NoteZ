-- Keep completed activity packages available without mixing them into the active list.
ALTER TABLE public.activities
  ADD COLUMN IF NOT EXISTS completed boolean NOT NULL DEFAULT false;

-- Older generated packages stored the useful source heading in subject while
-- putting an AI-created description in title. Keep the heading as the title.
UPDATE public.activities
SET title = btrim(subject)
WHERE subject IS NOT NULL
  AND btrim(subject) <> ''
  AND title IS DISTINCT FROM btrim(subject);

CREATE INDEX IF NOT EXISTS activities_user_completed_created_idx
  ON public.activities (user_id, completed, created_at DESC);
