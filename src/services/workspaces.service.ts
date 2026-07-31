import { supabase } from '@/integrations/supabase/client';

export type WorkspaceRole = 'owner' | 'admin' | 'editor' | 'viewer';

export interface Workspace {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
}

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: WorkspaceRole;
  invited_email: string | null;
  created_at: string;
}

export interface MemberProfile {
  user_id: string;
  full_name: string | null;
  email: string | null;
}

export const PENDING_USER = '00000000-0000-0000-0000-000000000000';

export async function fetchWorkspaces(): Promise<Workspace[]> {
  const { data, error } = await supabase
    .from('workspaces')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Workspace[];
}

export async function createWorkspace(userId: string, name: string): Promise<Workspace> {
  const { data, error } = await supabase
    .from('workspaces')
    .insert({ name: name.trim(), created_by: userId })
    .select()
    .single();
  if (error) throw error;
  return data as Workspace;
}

export async function fetchMembers(workspaceId: string): Promise<WorkspaceMember[]> {
  const { data, error } = await supabase
    .from('workspace_members')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as WorkspaceMember[];
}

export async function fetchMemberProfiles(userIds: string[]): Promise<MemberProfile[]> {
  if (!userIds.length) return [];
  const { data, error } = await supabase
    .from('profiles')
    .select('user_id, full_name, email')
    .in('user_id', userIds);
  if (error) throw error;
  return (data ?? []) as MemberProfile[];
}

export async function inviteMember(
  workspaceId: string,
  email: string,
  role: WorkspaceRole,
): Promise<{ isPending: boolean }> {
  const { data: existing } = await supabase
    .from('profiles')
    .select('user_id, email')
    .eq('email', email.toLowerCase())
    .maybeSingle();

  const payload = existing
    ? { workspace_id: workspaceId, user_id: existing.user_id, role }
    : { workspace_id: workspaceId, user_id: PENDING_USER, role, invited_email: email.toLowerCase() };

  const { error } = await supabase.from('workspace_members').insert(payload);
  if (error) throw error;
  return { isPending: !existing };
}

export async function changeMemberRole(memberId: string, role: WorkspaceRole): Promise<void> {
  const { error } = await supabase
    .from('workspace_members')
    .update({ role })
    .eq('id', memberId);
  if (error) throw error;
}

export async function removeMember(memberId: string): Promise<void> {
  const { error } = await supabase
    .from('workspace_members')
    .delete()
    .eq('id', memberId);
  if (error) throw error;
}
