/**
 * Centralized server-side Credits Metering for NoteZ Supabase Edge Functions.
 */

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export type MeteredAction =
  | "ai_chat"
  | "ai_audio_transcription"
  | "generate_exam"
  | "generate_flashcards"
  | "editor_ai_assist"
  | "activities_breakdown"
  | "source_processing"
  | "coach_advice";

export const CREDIT_COSTS: Record<MeteredAction, number> = {
  ai_chat: 5,
  ai_audio_transcription: 10,
  generate_exam: 25,
  generate_flashcards: 20,
  editor_ai_assist: 5,
  activities_breakdown: 20,
  source_processing: 25,
  coach_advice: 5,
};

export const ACTION_LABELS: Record<MeteredAction, string> = {
  ai_chat: "AI Chat Message",
  ai_audio_transcription: "Voice Audio Transcription",
  generate_exam: "Generate Exam",
  generate_flashcards: "Generate Flashcards",
  editor_ai_assist: "Editor AI Assist",
  activities_breakdown: "Syllabus Breakdown",
  source_processing: "Document Source Processing",
  coach_advice: "Coach Study Advice",
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
 * Server-side check and deduction of credits using service-role client.
 */
export async function checkAndDeductServer(
  userId: string,
  action: MeteredAction,
  supabaseUrl: string,
  serviceRoleKey: string,
  customCost?: number,
  description?: string,
): Promise<DeductResult> {
  const cost = customCost ?? CREDIT_COSTS[action] ?? 5;
  const admin: SupabaseClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const desc = description || ACTION_LABELS[action] || action;

  const { data, error } = await admin.rpc("check_and_deduct_credits", {
    p_user_id: userId,
    p_amount: cost,
    p_action: action,
    p_description: desc,
    p_metadata: {},
  });

  if (error) {
    console.warn("[credits] check_and_deduct_credits RPC failed:", error.message);
    // Fail open so service is not blocked if table is being migrated
    return { allowed: true };
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
}

/**
 * Returns structured 402/429 JSON response when credit limit is hit.
 */
export function creditLimitResponse(
  action: MeteredAction,
  deductResult: DeductResult,
  corsHeaders: Record<string, string>,
): Response {
  const cost = deductResult.required ?? CREDIT_COSTS[action];
  const label = ACTION_LABELS[action] || action;

  return new Response(
    JSON.stringify({
      error: deductResult.code || "INSUFFICIENT_CREDITS",
      action,
      cost,
      balance: deductResult.balance ?? 0,
      resetDate: deductResult.resetDate,
      tier: deductResult.tier || "free",
      message: `You need ${cost} credits to ${label.toLowerCase()}, but you currently have ${deductResult.balance ?? 0} credits.`,
    }),
    {
      status: 402, // Payment / Credit Required
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
}
