import { supabase } from '@/integrations/supabase/client';
import { checkAndDeductCredits, refundCredits } from '@/lib/credits';

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

export function cleanTaskLabel(label: string): string {
  if (!label) return '';
  return label.replace(/^(step|task|\d+)\s*\d*[:.-]\s*/i, '').trim();
}

export async function generateActivitiesFromDoc(
  documentText: string,
  fileName?: string,
  userId?: string,
): Promise<GeneratedActivityDraft[]> {
  // 1. Credit Check & Reservation
  const { data: authData } = await supabase.auth.getUser();
  const effectiveUserId = userId || authData?.user?.id;

  const creditRes = await checkAndDeductCredits(
    effectiveUserId,
    'activities_breakdown',
    20,
    `Syllabus Breakdown: ${fileName || 'Document'}`,
    { fileName },
  );

  if (!creditRes.success) {
    const err: any = new Error(`You need 20 credits to break down a syllabus, but you currently have ${creditRes.balanceAfter ?? 0} credits.`);
    err.error = creditRes.code || 'INSUFFICIENT_CREDITS';
    err.field = 'activities_breakdown';
    err.action = 'activities_breakdown';
    err.limit = 20;
    err.required = 20;
    err.balance = creditRes.balanceAfter;
    err.resetDate = creditRes.resetDate;
    throw err;
  }

  try {
    const { data, error } = await supabase.functions.invoke('activities-breakdown', {
      body: {
        documentText,
        fileName,
      },
    });

    if (error) throw error;
    if (data?.error) throw new Error(typeof data.error === 'string' ? data.error : 'Failed to generate activities');

    const drafts = data?.activities;
    if (Array.isArray(drafts) && drafts.length > 0) {
      return drafts.map((d: any) => ({
        title: d.title || 'Activity Package',
        subject: d.subject || 'General',
        description: d.description || 'Document requirements breakdown',
        tasks: Array.isArray(d.tasks) ? d.tasks.filter(Boolean).map(cleanTaskLabel) : ['Review document requirements'],
      }));
    }

    throw new Error('No activities returned from document breakdown service.');
  } catch (err: any) {
    console.error('Activities service error:', err);
    await refundCredits(effectiveUserId, 20, 'activities_breakdown', err?.message || 'Syllabus breakdown failed');
    throw new Error(err?.message || 'Unable to analyze document and generate activities. Please try again.');
  }
}

