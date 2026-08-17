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

/* ── Generate Activity Checklists from Document via Gemini ── */
export interface GeneratedActivityDraft {
  title: string;
  subject: string;
  description: string;
  tasks: string[];
}

const GEMINI_ACTIVITIES_API_KEY =
  import.meta.env.VITE_GEMINI_ACTIVITIES_API_KEY ||
  import.meta.env.GEMINI_ACTIVITIES_API_KEY ||
  '';

export function cleanTaskLabel(label: string): string {
  if (!label) return '';
  return label.replace(/^(step|task|\d+)\s*\d*[:.-]\s*/i, '').trim();
}

export async function generateActivitiesFromDoc(
  documentText: string,
  fileName?: string,
): Promise<GeneratedActivityDraft[]> {
  const prompt = `You are an expert academic project and task breakdown assistant.
Analyze the following document (syllabus, assignment rubric, project requirements, concept document, or presentation guidelines):

Document Name: "${fileName || 'Uploaded Document'}"
Document Content:
"""
${documentText.slice(0, 16000)}
"""

CRITICAL INSTRUCTIONS:
1. Extract and auto-generate structured Activity packages specifically for assignments, projects, concepts, or presentations found in the document.
2. For EACH activity package, assign detailed actionable checklist tasks covering ALL file content requirements specifically.
3. DO NOT prefix tasks with "Step 1:", "Step 2:", or "Task 1:". Output direct, clear action labels.

Return ONLY a valid JSON array matching this structure with no markdown or wrappers:
[
  {
    "title": "Assignment/Project Title",
    "subject": "Subject Name",
    "description": "Clear overview of requirements from document",
    "tasks": [
      "Conduct literature review on current state...",
      "Identify core ethical challenges...",
      "Analyze case studies..."
    ]
  }
]`;

  // 1. Try Vite proxy endpoint first (/api/generate-activities-from-doc)
  try {
    const res = await fetch('/api/generate-activities-from-doc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (res.ok) {
      const data = await res.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (rawText) {
        const cleanJson = rawText.replace(/^```json\s*/, '').replace(/```$/, '').trim();
        const drafts = JSON.parse(cleanJson);
        if (Array.isArray(drafts) && drafts.length > 0) {
          return drafts.map((d: any) => ({
            title: d.title || 'Activity Package',
            subject: d.subject || 'General',
            description: d.description || 'Document requirements breakdown',
            tasks: Array.isArray(d.tasks) ? d.tasks.filter(Boolean).map(cleanTaskLabel) : ['Review document requirements'],
          }));
        }
      }
    }
  } catch {
    /* silent fallback */
  }

  // 2. Direct Gemini REST endpoint fallback with gemini-3.1-flash-lite
  const fallbackModels = [
    'gemini-3.1-flash-lite',
    'gemini-2.5-flash-lite',
    'gemini-1.5-flash-lite',
    'gemini-2.0-flash-lite',
  ];

  for (const model of fallbackModels) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_ACTIVITIES_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.7,
              responseMimeType: 'application/json',
            },
          }),
        },
      );

      if (!res.ok) continue;
      const data = await res.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) continue;

      const cleanJson = rawText.replace(/^```json\s*/, '').replace(/```$/, '').trim();
      const drafts = JSON.parse(cleanJson);

      if (Array.isArray(drafts) && drafts.length > 0) {
        return drafts.map((d: any) => ({
          title: d.title || 'Activity Package',
          subject: d.subject || 'General',
          description: d.description || 'Document requirements breakdown',
          tasks: Array.isArray(d.tasks) ? d.tasks.filter(Boolean).map(cleanTaskLabel) : ['Review document requirements'],
        }));
      }
    } catch {
      /* continue to next model */
    }
  }

  throw new Error('Unable to analyze document and generate activities. Please try again.');
}
