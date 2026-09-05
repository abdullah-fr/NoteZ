/**
 * Centralized server-side Credits Metering for NoteZ Supabase Edge Functions.
 */

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export type MeteredAction =
  | "ai_chat"
  | "generate_exam"
  | "generate_flashcards"
  | "editor_ai_assist"
  | "activities_breakdown"
  | "coach_advice"
  | "source_processing";

export const CREDIT_COSTS: Record<MeteredAction, number> = {
  ai_chat: 1,
  generate_exam: 1,
  generate_flashcards: 1,
  editor_ai_assist: 1,
  activities_breakdown: 1,
  coach_advice: 1,
  source_processing: 1,
};

export const ACTION_LABELS: Record<MeteredAction, string> = {
  ai_chat: "AI Chat Message",
  generate_exam: "Generate Practice Exam",
  generate_flashcards: "Generate Flashcards",
  editor_ai_assist: "Editor AI Assist",
  activities_breakdown: "Syllabus Breakdown",
  coach_advice: "Coach Advice",
  source_processing: "Process Study Source",
};

export interface DeductResult {
  allowed: boolean;
  code?: string;
  balance?: number;
  required?: number;
  resetDate?: string;
  tier?: string;
}

/**
 * Server-side check and deduction of credits using the service-role client.
 * This is intentionally fail-closed: an unavailable ledger must never allow
 * an AI request to bypass the monthly allowance.
 */
export async function checkAndDeductServer(
  userId: string,
  action: MeteredAction,
  supabaseUrl: string,
  serviceRoleKey: string,
  description?: string,
): Promise<DeductResult> {
  const cost = 1;
  const admin: SupabaseClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const desc = description || ACTION_LABELS[action] || action;

  try {
    const { data, error } = await admin.rpc("check_and_deduct_credits", {
      p_user_id: userId,
      p_amount: cost,
      p_action: action,
      p_description: desc,
      p_metadata: {},
    });

    if (error) {
      console.error("[credits] deduction RPC failed");
      return { allowed: false, code: "CREDITS_UNAVAILABLE", required: cost };
    }

    const res = data as any;
    if (res?.success) {
      return { allowed: true, balance: res.balance_after };
    }

    return {
      allowed: false,
      code: res?.code || "INSUFFICIENT_CREDITS",
      balance: res?.balance,
      required: res?.required || cost,
      resetDate: res?.reset_date,
      tier: res?.tier || "free",
    };
  } catch {
    console.error("[credits] deduction RPC exception");
    return { allowed: false, code: "CREDITS_UNAVAILABLE", required: cost };
  }
}

/**
 * Server-side credit refund helper for failed requests.
 */
export async function refundServer(
  userId: string,
  amount: number,
  action: MeteredAction,
  reason: string,
  supabaseUrl: string,
  serviceRoleKey: string,
): Promise<void> {
  if (amount <= 0) return;
  try {
    const admin: SupabaseClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    await admin.rpc("refund_credits", {
      p_user_id: userId,
      p_amount: amount,
      p_action: action,
      p_reason: reason,
      p_metadata: {},
    });
  } catch {
    console.warn("[credits] refund failed");
  }
}

/**
 * Returns structured 402 JSON response when credit limit is reached.
 */
export function creditLimitResponse(
  action: MeteredAction,
  deductResult: DeductResult,
  corsHeaders: Record<string, string>,
): Response {
  const cost = deductResult.required ?? CREDIT_COSTS[action] ?? 1;
  const label = ACTION_LABELS[action] || action;
  const unavailable = deductResult.code === "CREDITS_UNAVAILABLE";

  return new Response(
    JSON.stringify({
      error: deductResult.code || "MONTHLY_LIMIT_REACHED",
      action,
      cost,
      balance: deductResult.balance ?? 0,
      resetDate: deductResult.resetDate,
      tier: deductResult.tier || "free",
      message: unavailable
        ? "The AI allowance service is temporarily unavailable. Please try again shortly."
        : `Your monthly AI allowance is exhausted. Wait for the reset or choose a paid plan to continue with ${label.toLowerCase()}.`,
    }),
    {
      status: unavailable ? 503 : 402,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
}
