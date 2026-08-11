-- Prompt 21: Class Hub — extends workspaces with class type + join codes
ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS type      TEXT NOT NULL DEFAULT 'study_group'
    CHECK (type IN ('study_group', 'class')),
  ADD COLUMN IF NOT EXISTS join_code TEXT UNIQUE;

-- Generate a random 6-char join code for class workspaces
CREATE OR REPLACE FUNCTION generate_join_code() RETURNS TEXT
LANGUAGE sql AS $$
  SELECT upper(substring(md5(random()::text) from 1 for 6));
$$;

-- Shared class items (activities/events visible to all members)
CREATE TABLE IF NOT EXISTS class_shared_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  kind         TEXT NOT NULL CHECK (kind IN ('activity', 'calendar_event')),
  title        TEXT NOT NULL,
  payload      JSONB NOT NULL DEFAULT '{}',
  created_by   UUID NOT NULL REFERENCES auth.users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE class_shared_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Workspace members can view shared items" ON class_shared_items
  FOR SELECT USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Admins can manage shared items" ON class_shared_items
  FOR ALL USING (can_admin_workspace(auth.uid(), workspace_id));

-- Prompt 11: Leaderboard opt-in per user per workspace
ALTER TABLE workspace_members
  ADD COLUMN IF NOT EXISTS leaderboard_opted_in BOOLEAN NOT NULL DEFAULT false;

-- Weekly leaderboard view (resets every Monday — computed on demand)
-- This is a view, not a table, so it always reflects current data.
CREATE OR REPLACE VIEW workspace_leaderboard AS
SELECT
  wm.workspace_id,
  wm.user_id,
  p.full_name,
  COALESCE(up.total_study_minutes, 0) AS focus_minutes,
  COALESCE(up.streak_days, 0)         AS streak_days
FROM workspace_members wm
JOIN profiles    p  ON p.user_id  = wm.user_id
LEFT JOIN user_progress up ON up.user_id = wm.user_id
WHERE wm.leaderboard_opted_in = true;

GRANT SELECT ON workspace_leaderboard TO authenticated;
