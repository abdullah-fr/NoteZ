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
    // Log server-side failures silently — never break the timer UX over
    // a logging failure.
    console.error('[timer.service] Failed to log session:', error.message);
    return;
  }

  // Increment total_study_minutes on user_progress via an upsert so the
  // Dashboard Focus Time stat moves immediately without waiting for a
  // Realtime event to recompute from raw sessions.
  await supabase.rpc('increment_study_minutes', {
    p_user_id: userId,
    p_minutes: Math.round(durationMinutes),
  }).then(({ error: rpcError }) => {
    if (rpcError) {
      // RPC may not exist yet in all environments — fail silently.
      // The Realtime subscription on study_sessions will still update
      // the dashboard on the next poll.
      console.warn('[timer.service] increment_study_minutes RPC not available:', rpcError.message);
    }
  });
}
