/**
 * Editor AI Assist Service
 * Invokes Supabase Edge Function with Centralized Credit Metering (5 credits)
 */

import { supabase } from '@/integrations/supabase/client';
import { checkAndDeductCredits, refundCredits } from '@/lib/credits';

export async function editorAiAssist(action: string, selectedText: string, userId?: string): Promise<string> {
  if (!selectedText.trim()) return selectedText;

  // 1. Credit Check & Reservation
  const { data: authData } = await supabase.auth.getUser();
  const effectiveUserId = userId || authData?.user?.id;

  const creditRes = await checkAndDeductCredits(
    effectiveUserId,
    'editor_ai_assist',
    5,
    `Editor Assist: ${action}`,
    { action, textLength: selectedText.length },
  );

  if (!creditRes.success) {
    const err: any = new Error(`You need 5 credits for Editor AI Assist, but you currently have ${creditRes.balanceAfter ?? 0} credits.`);
    err.error = creditRes.code || 'INSUFFICIENT_CREDITS';
    err.field = 'editor_ai_assist';
    err.action = 'editor_ai_assist';
    err.limit = 5;
    err.required = 5;
    err.balance = creditRes.balanceAfter;
    err.resetDate = creditRes.resetDate;
    throw err;
  }

  // 2. Invoke Supabase Edge Function
  try {
    const { data, error } = await supabase.functions.invoke('editor-ai', {
      body: {
        action,
        text: selectedText,
      },
    });

    if (error) throw error;
    if (data?.error) throw new Error(typeof data.error === 'string' ? data.error : 'Editor assist failed');

    if (data?.result && typeof data.result === 'string') {
      return data.result.trim();
    }

    return selectedText;
  } catch (err: any) {
    console.error('Editor AI error:', err);
    // Automatic safe refund on failure
    await refundCredits(effectiveUserId, 5, 'editor_ai_assist', err?.message || 'Editor assist AI call failed');
    return selectedText;
  }
}
