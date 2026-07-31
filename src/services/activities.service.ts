import { supabase } from '@/integrations/supabase/client';

export interface Activity {
  id: string;
  title: string;
  description: string | null;
  subject: string | null;
  progress: number;
  created_at: string;
  updated_at: string;
}

export interface ChecklistItem {
  id: string;
  activity_id: string;
  label: string;
  done: boolean;
  position: number;
}

export async function fetchActivities(userId: string): Promise<Activity[]> {
  const { data, error } = await supabase
    .from('activities')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Activity[];
}

export async function fetchChecklistItems(userId: string): Promise<ChecklistItem[]> {
  const { data, error } = await supabase
    .from('activity_checklist_items')
    .select('*')
    .eq('user_id', userId)
    .order('position');
  if (error) throw error;
  return (data ?? []) as ChecklistItem[];
}

export async function createActivity(
  userId: string,
  payload: { title: string; description?: string | null; subject?: string | null },
): Promise<Activity> {
  const { data, error } = await supabase
    .from('activities')
    .insert({ user_id: userId, ...payload, progress: 0 })
    .select()
    .single();
  if (error) throw error;
  return data as Activity;
}

export async function updateActivityProgress(activityId: string, progress: number): Promise<void> {
  const { error } = await supabase
    .from('activities')
    .update({ progress })
    .eq('id', activityId);
  if (error) throw error;
}

export async function deleteActivity(activityId: string): Promise<void> {
  const { error } = await supabase.from('activities').delete().eq('id', activityId);
  if (error) throw error;
}

export async function addChecklistItems(
  rows: { activity_id: string; user_id: string; label: string; position: number }[],
): Promise<void> {
  const { error } = await supabase.from('activity_checklist_items').insert(rows);
  if (error) throw error;
}

export async function addChecklistItem(
  activityId: string,
  userId: string,
  label: string,
  position: number,
): Promise<ChecklistItem> {
  const { data, error } = await supabase
    .from('activity_checklist_items')
    .insert({ activity_id: activityId, user_id: userId, label, position })
    .select()
    .single();
  if (error) throw error;
  return data as ChecklistItem;
}

export async function toggleChecklistItem(itemId: string, done: boolean): Promise<void> {
  const { error } = await supabase
    .from('activity_checklist_items')
    .update({ done })
    .eq('id', itemId);
  if (error) throw error;
}

export async function deleteChecklistItem(itemId: string): Promise<void> {
  const { error } = await supabase
    .from('activity_checklist_items')
    .delete()
    .eq('id', itemId);
  if (error) throw error;
}
