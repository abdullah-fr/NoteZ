-- Streak freeze mechanic (Prompt 7)
ALTER TABLE user_progress
  ADD COLUMN IF NOT EXISTS streak_freezes_available INTEGER NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS streak_freeze_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  used_on_date DATE NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE streak_freeze_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own freeze log" ON streak_freeze_log
  FOR SELECT USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_freeze_log_user ON streak_freeze_log(user_id);
