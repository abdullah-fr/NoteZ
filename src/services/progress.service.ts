import { supabase } from '@/integrations/supabase/client';
import { subDays } from 'date-fns';

export interface UserProgress {
  xp: number;
  level: number;
  streak_days: number;
  total_study_minutes: number;
  exams_completed: number;
  flashcards_reviewed: number;
  quizzes_completed: number;
  streak_freezes_available?: number;
}

export interface ExamResult {
  score: number;
  total_questions: number;
  created_at: string;
}

export interface StudySession {
  duration_minutes: number;
  started_at: string;
}

/**
 * The dashboard only needs the schema-stable creation timestamp. Keeping this
 * query separate avoids probing optional FSRS columns on older deployments.
 */
export interface FlashcardActivity {
  created_at: string;
}

export async function fetchFlashcardActivity(userId: string): Promise<FlashcardActivity[]> {
  const { data, error } = await supabase
    .from('flashcards')
    .select('created_at')
    .eq('user_id', userId);

  if (error) return [];
  return (data ?? []) as FlashcardActivity[];
}

export async function fetchProgressData(userId: string): Promise<{
  progress: UserProgress;
  examResults: ExamResult[];
  sessions: StudySession[];
}> {
  const yearAgo = subDays(new Date(), 365).toISOString();

  const [progressRes, examsRes, sessionsRes] = await Promise.all([
    supabase.from('user_progress').select('*').eq('user_id', userId).maybeSingle(),
    supabase
      .from('exam_results')
      .select('score, total_questions, created_at')
      .eq('user_id', userId)
      .gte('created_at', yearAgo),
    supabase
      .from('study_sessions')
      .select('duration_minutes, started_at')
      .eq('user_id', userId)
      .gte('started_at', yearAgo),
  ]);

  const defaultProgress: UserProgress = {
    xp: 0,
    level: 1,
    streak_days: 0,
    total_study_minutes: 0,
    exams_completed: 0,
    flashcards_reviewed: 0,
    quizzes_completed: 0,
  };

  const progress: UserProgress = progressRes.data
    ? {
        xp: progressRes.data.xp,
        level: progressRes.data.level,
        streak_days: progressRes.data.streak_days,
        total_study_minutes: progressRes.data.total_study_minutes,
        exams_completed: progressRes.data.exams_completed,
        flashcards_reviewed: progressRes.data.flashcards_reviewed,
        quizzes_completed: progressRes.data.quizzes_completed,
        streak_freezes_available: progressRes.data.streak_freezes_available ?? 1,
      }
    : defaultProgress;

  return {
    progress,
    examResults: (examsRes.data ?? []) as ExamResult[],
    sessions: (sessionsRes.data ?? []) as StudySession[],
  };
}

export function subscribeToProgressUpdates(
  userId: string,
  onChange: () => void,
) {
  const channel = supabase
    .channel(`dashboard-realtime-${userId}`)
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'study_sessions',
      filter: `user_id=eq.${userId}`,
    }, onChange)
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'exam_results',
      filter: `user_id=eq.${userId}`,
    }, onChange)
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'user_progress',
      filter: `user_id=eq.${userId}`,
    }, onChange)
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'flashcards',
      filter: `user_id=eq.${userId}`,
    }, onChange)
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'activities',
      filter: `user_id=eq.${userId}`,
    }, onChange)
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'activity_checklist_items',
      filter: `user_id=eq.${userId}`,
    }, onChange)
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}
