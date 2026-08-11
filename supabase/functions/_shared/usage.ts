/**
 * Shared usage metering helper for NoteZ edge functions.
 *
 * All reads/writes use the service-role key so the client can never
 * manipulate counters. Limits are set generously so a real daily study
 * session never hits them — the goal is cost control, not friction.
 *
 * Tier limits:
 *   free:        20 ai-chat messages/day, 2 exam generations/week, 1 source upload/month
 *   pro_student: 500 ai-chat messages/day (soft abuse cap only), unlimited exams/sources
 *   pro_scholar: same as pro_student
 *   team:        same as pro_student
 */

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export type CounterField = "ai_chat_messages_count" | "exam_generations_count" | "source_uploads_count";
export type PeriodType    = "day" | "week" | "month";

interface TierLimits {
  ai_chat_messages_count:  number; // per day
  exam_generations_count:  number; // per week
  source_uploads_count:    number; // per month
}

const LIMITS: Record<string, TierLimits> = {
  free:        { ai_chat_messages_count: 20,  exam_generations_count: 2,    source_uploads_count: 1   },
  pro_student: { ai_chat_messages_count: 500, exam_generations_count: 9999, source_uploads_count: 9999 },
  pro_scholar: { ai_chat_messages_count: 500, exam_generations_count: 9999, source_uploads_count: 9999 },
  team:        { ai_chat_messages_count: 500, exam_generations_count: 9999, source_uploads_count: 9999 },
};

const PERIOD: Record<CounterField, PeriodType> = {
  ai_chat_messages_count:  "day",
  exam_generations_count:  "week",
  source_uploads_count:    "month",
};

/** Returns the UTC period-start date string (YYYY-MM-DD) for a given period type. */
function periodStart(type: PeriodType): string {
  const now = new Date();
  if (type === "day") {
    return now.toISOString().slice(0, 10);
  }
  if (type === "week") {
    // Monday of the current UTC week
    const day = now.getUTCDay(); // 0 = Sunday
    const monday = new Date(now);
    monday.setUTCDate(now.getUTCDate() - ((day + 6) % 7));
    return monday.toISOString().slice(0, 10);
  }
  // month
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

/**
 * Checks the user's current counter for the given field, increments it if
 * under the limit, and returns { allowed: true } — or { allowed: false,
 * limit, current } if the limit is reached.
 *
 * All DB access uses the service-role key (admin client) so it cannot be
 * spoofed from the browser.
 */
export async function checkAndIncrement(
  userId: string,
  field: CounterField,
  supabaseUrl: string,
  serviceRoleKey: string,
): Promise<{ allowed: boolean; limit?: number; current?: number }> {
  const admin: SupabaseClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Look up tier
  const { data: profile } = await admin
    .from("profiles")
    .select("tier")
    .eq("user_id", userId)
    .maybeSingle();
  const tier: string = (profile?.tier as string) ?? "free";
  const limits = LIMITS[tier] ?? LIMITS.free;
  const limit  = limits[field];

  const period = PERIOD[field];
  const ps     = periodStart(period);

  // Upsert the counter row, incrementing atomically
  const { data, error } = await admin.rpc("upsert_usage_counter", {
    p_user_id:    userId,
    p_period:     ps,
    p_field:      field,
    p_limit:      limit,
  });

  if (error) {
    // If the RPC doesn't exist yet (migration pending), fail open so
    // existing functionality is never broken.
    console.warn("[usage] upsert_usage_counter RPC unavailable:", error.message);
    return { allowed: true };
  }

  const result = data as { allowed: boolean; current: number };
  return result.allowed
    ? { allowed: true }
    : { allowed: false, limit, current: result.current };
}

/** Builds the standard 429 response body for a limit-reached error. */
export function limitReachedResponse(
  field: CounterField,
  limit: number,
  corsHeaders: Record<string, string>,
): Response {
  const labels: Record<CounterField, string> = {
    ai_chat_messages_count:  "daily AI chat messages",
    exam_generations_count:  "weekly exam generations",
    source_uploads_count:    "monthly document uploads",
  };
  return new Response(
    JSON.stringify({
      error:      "USAGE_LIMIT_REACHED",
      field,
      limit,
      label:      labels[field],
      message:    `You've reached your ${labels[field]} limit for this period. Upgrade to continue.`,
    }),
    { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}
