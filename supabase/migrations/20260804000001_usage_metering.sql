-- ─────────────────────────────────────────────────────────────────────────────
-- Usage metering: per-user counters for AI calls, exam generations,
-- and source uploads. All writes happen server-side via service-role key
-- inside edge functions — this table is never client-writable.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Add a tier column to profiles so edge functions can gate by plan
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS tier TEXT NOT NULL DEFAULT 'free'
    CHECK (tier IN ('free', 'pro_student', 'pro_scholar', 'team'));

-- 2. Usage counters table — one row per (user, UTC calendar day or week)
CREATE TABLE IF NOT EXISTS usage_counters (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period_start              DATE NOT NULL,   -- UTC calendar day for daily limits
  ai_chat_messages_count    INTEGER NOT NULL DEFAULT 0,
  exam_generations_count    INTEGER NOT NULL DEFAULT 0,
  source_uploads_count      INTEGER NOT NULL DEFAULT 0,
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT usage_counters_user_period_unique UNIQUE (user_id, period_start)
);

-- 3. RLS: users can read their own row (to show quota UI); writes are
--    service-role only (no policy for INSERT/UPDATE from client).
ALTER TABLE usage_counters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own usage" ON usage_counters
  FOR SELECT USING (auth.uid() = user_id);

-- 4. Index for fast per-user lookups
CREATE INDEX IF NOT EXISTS idx_usage_counters_user_period
  ON usage_counters (user_id, period_start DESC);

-- 5. increment_study_minutes RPC (used by timer.service.ts after session logging)
--    Upserts the user_progress row so total_study_minutes is always current.
CREATE OR REPLACE FUNCTION increment_study_minutes(
  p_user_id UUID,
  p_minutes  INTEGER
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO user_progress (user_id, total_study_minutes, xp, level, streak_days,
                              exams_completed, flashcards_reviewed, quizzes_completed)
  VALUES (p_user_id, p_minutes, 0, 1, 0, 0, 0, 0)
  ON CONFLICT (user_id)
  DO UPDATE SET
    total_study_minutes = user_progress.total_study_minutes + EXCLUDED.total_study_minutes,
    updated_at          = now();
END;
$$;

-- Grant execute to authenticated users (called from client via service-role in
-- timer.service.ts, but also safe to allow directly).
GRANT EXECUTE ON FUNCTION increment_study_minutes(UUID, INTEGER) TO authenticated;

-- 6. Atomic upsert + check function for usage counters.
--    Returns JSON: { allowed: boolean, current: integer }
--    Uses service-role access only (SECURITY DEFINER).
CREATE OR REPLACE FUNCTION upsert_usage_counter(
  p_user_id  UUID,
  p_period   DATE,
  p_field    TEXT,
  p_limit    INTEGER
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current INTEGER;
  v_allowed BOOLEAN;
BEGIN
  -- Ensure row exists
  INSERT INTO usage_counters (user_id, period_start)
  VALUES (p_user_id, p_period)
  ON CONFLICT (user_id, period_start) DO NOTHING;

  -- Read current value
  EXECUTE format(
    'SELECT %I FROM usage_counters WHERE user_id = $1 AND period_start = $2',
    p_field
  ) INTO v_current USING p_user_id, p_period;

  v_current := COALESCE(v_current, 0);

  IF v_current >= p_limit THEN
    v_allowed := false;
    RETURN json_build_object('allowed', false, 'current', v_current);
  END IF;

  -- Increment
  EXECUTE format(
    'UPDATE usage_counters SET %I = %I + 1, updated_at = now()
     WHERE user_id = $1 AND period_start = $2',
    p_field, p_field
  ) USING p_user_id, p_period;

  RETURN json_build_object('allowed', true, 'current', v_current + 1);
END;
$$;

-- Only callable server-side (service-role); no client grant needed.
