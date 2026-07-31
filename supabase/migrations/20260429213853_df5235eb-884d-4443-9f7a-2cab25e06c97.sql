-- 1. Lock down SECURITY DEFINER helper functions: revoke from anon/authenticated.
--    They are still callable by RLS policies (which run as table owner) but not
--    directly callable via PostgREST/RPC by client roles.
REVOKE EXECUTE ON FUNCTION public.is_workspace_member(uuid, uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.can_edit_workspace(uuid, uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.can_admin_workspace(uuid, uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.workspace_role_of(uuid, uuid) FROM anon, authenticated, public;

-- 2. Realtime: scope subscriptions so only authenticated users may subscribe,
--    and only to workspace topics they are members of, or to their own user topic.
--    Default-deny anon entirely.
DROP POLICY IF EXISTS "realtime_authenticated_read" ON realtime.messages;
DROP POLICY IF EXISTS "realtime_authenticated_write" ON realtime.messages;

CREATE POLICY "realtime_authenticated_read"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (
    -- own user topic, e.g. "user:<uid>"
    realtime.topic() = 'user:' || auth.uid()::text
    -- workspace topic, e.g. "workspace:<workspace_uuid>"
    OR (
      realtime.topic() LIKE 'workspace:%'
      AND public.is_workspace_member(
        substring(realtime.topic() from 11)::uuid,
        auth.uid()
      )
    )
  );

CREATE POLICY "realtime_authenticated_write"
  ON realtime.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    realtime.topic() = 'user:' || auth.uid()::text
    OR (
      realtime.topic() LIKE 'workspace:%'
      AND public.is_workspace_member(
        substring(realtime.topic() from 11)::uuid,
        auth.uid()
      )
    )
  );