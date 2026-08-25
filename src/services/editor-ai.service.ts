/**
 * Editor AI Assist Service
 * Powered by Gemini 3.1 Flash Lite with Centralized Credit Metering (5 credits)
 */

import { supabase } from '@/integrations/supabase/client';
import { checkAndDeductCredits, refundCredits } from '@/lib/credits';

const GEMINI_AI_ASSIST_API_KEY =
  import.meta.env.VITE_GEMINI_AI_ASSIST_API_KEY ||
  import.meta.env.GEMINI_AI_ASSIST_API_KEY ||
  '';

const ACTION_PROMPTS: Record<string, string> = {
  improve: 'Improve the grammar, clarity, style, and flow of the following text while preserving its meaning. Return ONLY the improved version.',
  rephrase: 'Rephrase the following text to make it clear, concise, and engaging. Return ONLY the rephrased version.',
  summarize: 'Summarize the key concepts of the following text into clear bullet points for study notes. Return ONLY the summary.',
  explain: 'Explain the concepts in the following text simply and clearly as an expert tutor. Return ONLY the explanation.',
  flashcard: 'Create a flashcard question and answer pair based on the following text (Format: Q: ...\nA: ...). Return ONLY the Q&A pair.',
};

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

  const actionInstruction = ACTION_PROMPTS[action] || `Perform "${action}" on the following text for study notes. Return ONLY the transformed text.`;
  const prompt = `${actionInstruction}\n\nInput Text:\n"""\n${selectedText.slice(0, 12000)}\n"""`;

  // 1. Try local Vite proxy endpoint first (/api/editor-ai-assist)
  try {
    const res = await fetch('/api/editor-ai-assist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
        },
      }),
    });

    if (res.ok) {
      const data = await res.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (rawText && rawText.trim()) {
        return rawText.trim();
      }
    }
  } catch {
    /* fallback to direct fetch */
  }

  // 2. Direct Gemini REST endpoint fallback with gemini-3.1-flash-lite
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${GEMINI_AI_ASSIST_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
          },
        }),
      },
    );

    if (res.ok) {
      const data = await res.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (rawText && rawText.trim()) {
        return rawText.trim();
      }
    }
  } catch {
    /* silent fallback */
  }

  // If failed, refund credits
  await refundCredits(effectiveUserId, 5, 'editor_ai_assist', 'Editor assist AI call failed');
  return selectedText;
}
