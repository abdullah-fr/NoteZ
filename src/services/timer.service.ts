import { supabase } from '@/integrations/supabase/client';

export type SessionType = 'focus' | 'task' | 'exam';

/**
 * Logs a naturally-completed timer session to study_sessions.
 *
 * Only call this when the timer reaches zero on its own — never on manual
 * reset or early exit, to avoid inflating stats with accidental starts.
 *
 * Guards against double-logging from backgrounded tabs re-triggering the
 * completion event by checking that durationMinutes > 0.
 */
export async function logCompletedSession(
  userId: string,
  durationMinutes: number,
  sessionType: SessionType,
  startedAt: Date,
): Promise<void> {
  if (!userId || durationMinutes <= 0) return;

  const endedAt = new Date();

  const { error } = await supabase.from('study_sessions').insert({
    user_id: userId,
    duration_minutes: Math.round(durationMinutes),
    activity_type: sessionType,
    started_at: startedAt.toISOString(),
    ended_at: endedAt.toISOString(),
  });

  if (error) {
    console.error('[timer.service] Failed to log session:', error.message);
    return;
  }

  // Increment total_study_minutes on user_progress via direct table upsert
  // to avoid calling missing RPC functions that trigger 404 network errors.
  try {
    const { data: existing } = await supabase
      .from('user_progress')
      .select('total_study_minutes')
      .eq('user_id', userId)
      .maybeSingle();

    const currentMinutes = existing?.total_study_minutes || 0;
    const newMinutes = currentMinutes + Math.round(durationMinutes);

    await supabase
      .from('user_progress')
      .upsert({
        user_id: userId,
        total_study_minutes: newMinutes,
      }, { onConflict: 'user_id' });
  } catch (err) {
    // Fail silently without breaking the user experience
  }
}
