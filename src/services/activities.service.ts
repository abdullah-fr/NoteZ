import { supabase } from '@/integrations/supabase/client';
import { reportCreditFunctionError, syncCreditsAfterRequest } from '@/lib/credits';
import { getSafeClientErrorMessage, reportClientError } from '@/lib/client-logging';

export interface Activity {
  id: string;
  title: string;
  description: string | null;
  subject: string | null;
  progress: number;
  completed: boolean;
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

export interface GeneratedActivityDraft {
  title: string;
  subject: string;
  description: string;
  tasks: string[];
}

interface RawGeneratedActivity {
  title?: unknown;
  subject?: unknown;
  description?: unknown;
  tasks?: unknown;
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
    .insert({ ...payload, user_id: userId, progress: 0 })
    .select()
    .single();
  if (error) throw error;
  return data as Activity;
}

export async function updateActivityProgress(userId: string, activityId: string, progress: number): Promise<void> {
  const { error } = await supabase
    .from('activities')
    .update({ progress })
    .eq('id', activityId)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function updateActivityCompleted(userId: string, activityId: string, completed: boolean): Promise<void> {
  const { error } = await supabase
    .from('activities')
    .update({ completed })
    .eq('id', activityId)
    .eq('user_id', userId);
  if (!error) return;

  // A remote project that was created before the completion migration returns
  // HTTP 400 with PGRST204 when PostgREST cannot find this column. Surface a
  // useful deployment error instead of hiding the actual cause behind a
  // generic toast.
  if (error.code === 'PGRST204' || /completed.*column|column.*completed|schema cache/i.test(error.message)) {
    throw new Error('Activity completion is not enabled in the database yet. Apply the activity completion migration and try again.');
  }

  throw error;
}

export async function deleteActivity(userId: string, activityId: string): Promise<void> {
  const { error } = await supabase
    .from('activities')
    .delete()
    .eq('id', activityId)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function addChecklistItems(
  userId: string,
  rows: { activity_id: string; label: string; position: number }[],
): Promise<void> {
  // The account boundary is derived from the authenticated caller, not from
  // a user_id field supplied by a draft or imported document.
  const { error } = await supabase
    .from('activity_checklist_items')
    .insert(rows.map(row => ({ ...row, user_id: userId })));
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

export async function toggleChecklistItem(userId: string, itemId: string, done: boolean): Promise<void> {
  const { error } = await supabase
    .from('activity_checklist_items')
    .update({ done })
    .eq('id', itemId)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function updateChecklistItemLabel(userId: string, itemId: string, label: string): Promise<void> {
  const { error } = await supabase
    .from('activity_checklist_items')
    .update({ label })
    .eq('id', itemId)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function deleteChecklistItem(userId: string, itemId: string): Promise<void> {
  const { error } = await supabase
    .from('activity_checklist_items')
    .delete()
    .eq('id', itemId)
    .eq('user_id', userId);
  if (error) throw error;
}

export function cleanTaskLabel(label: string): string {
  if (!label) return '';
  return label.replace(/^(step|task|\d+)\s*\d*[:.-]\s*/i, '').trim();
}

export async function generateActivitiesFromDoc(
  documentText: string,
  fileName?: string,
  userId?: string,
): Promise<GeneratedActivityDraft[]> {
  const { data: authData } = await supabase.auth.getUser();
  const effectiveUserId = userId || authData?.user?.id;

  try {
    const { data, error } = await supabase.functions.invoke('activities-breakdown', {
      body: {
        documentText,
        fileName,
      },
    });

    if (error) {
      await reportCreditFunctionError(error);
      throw error;
    }
    if (data?.error) throw new Error(typeof data.error === 'string' ? data.error : 'Failed to generate activities');

    const drafts = data?.activities;
    if (Array.isArray(drafts) && drafts.length > 0) {
      await syncCreditsAfterRequest(effectiveUserId);
      return drafts.map((draft: unknown) => {
        const d = (draft && typeof draft === 'object' ? draft : {}) as RawGeneratedActivity;
        const subject = typeof d.subject === 'string' && d.subject.trim() ? d.subject.trim() : 'General';
        const generatedTitle = typeof d.title === 'string' && d.title.trim() ? d.title.trim() : 'Activity Package';
        // The source topic is the activity heading; generated explanations belong in the description/tasks.
        const title = subject !== 'General' ? subject : generatedTitle;
        const description = typeof d.description === 'string' && d.description.trim()
          ? d.description.trim()
          : 'Document requirements breakdown';
        const tasks = Array.isArray(d.tasks)
          ? d.tasks.filter((task): task is string => typeof task === 'string' && Boolean(task.trim())).map(cleanTaskLabel)
          : ['Review document requirements'];
        return { title, subject, description, tasks };
      });
    }

    throw new Error('No activities returned from document breakdown service.');
  } catch (err: unknown) {
    reportClientError('activities-service');
    await reportCreditFunctionError(err);
    await syncCreditsAfterRequest(effectiveUserId);
    throw new Error(getSafeClientErrorMessage(err, 'Unable to analyze document and generate activities. Please try again.'));
  }
}
