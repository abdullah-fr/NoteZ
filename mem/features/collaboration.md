---
name: Collaboration / Workspaces
description: Shared workspaces for inviting teammates by email and sharing notes/sources/chats with role-based permissions
type: feature
---
Tables: workspaces (name, created_by), workspace_members (role: owner/admin/editor/viewer, invited_email for pending invites with placeholder user_id 00000000-0000-0000-0000-000000000000).
Helper SECURITY DEFINER functions: is_workspace_member, workspace_role_of, can_edit_workspace, can_admin_workspace — required to avoid RLS recursion.
Trigger add_workspace_owner auto-adds creator as owner. Trigger resolve_workspace_invites on auth.users links pending email invites to new accounts on signup.
Tables `notes`, `sources`, `chat_conversations` got `workspace_id` column. Additive RLS policies grant SELECT to workspace members and UPDATE to editors+; original owner policies still apply.
UI: src/components/dashboard/WorkspacesView.tsx — list workspaces, create, invite by email (resolves to user_id if profile exists else stays pending), change roles, remove members, leave workspace, copy invite link.