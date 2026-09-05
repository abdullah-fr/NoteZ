-- Store authenticated feedback submissions and private attachment metadata.
-- Image bytes remain in the private uploads/<user_id>/feedback/ prefix.

CREATE TABLE IF NOT EXISTS public.feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('bug', 'feature', 'general')),
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  message TEXT NOT NULL CHECK (char_length(btrim(message)) BETWEEN 1 AND 5000),
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(attachments) = 'array'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own feedback" ON public.feedback;
CREATE POLICY "Users can view own feedback" ON public.feedback
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can submit own feedback" ON public.feedback;
CREATE POLICY "Users can submit own feedback" ON public.feedback
  FOR INSERT WITH CHECK (auth.uid() = user_id);

REVOKE ALL ON TABLE public.feedback FROM PUBLIC, anon;
GRANT SELECT, INSERT ON TABLE public.feedback TO authenticated;

CREATE INDEX IF NOT EXISTS idx_feedback_user_created
  ON public.feedback(user_id, created_at DESC);
