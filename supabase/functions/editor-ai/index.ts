import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { checkAndDeductServer, creditLimitResponse, refundServer } from "../_shared/credits.ts";
import { geminiModelUrl, geminiRefundReason, geminiResponseError, getGeminiApiKey } from "../_shared/gemini.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ACTION_PROMPTS: Record<string, string> = {
  improve: "Improve the grammar, clarity, style, and flow of the following text while preserving its meaning. Return ONLY the improved version.",
  rephrase: "Rephrase the following text to make it clear, concise, and engaging. Return ONLY the rephrased version.",
  summarize: "Summarize the key concepts of the following text into clear bullet points for study notes. Return ONLY the summary.",
  explain: "Explain the concepts in the following text simply and clearly as an expert tutor. Return ONLY the explanation.",
  flashcard: "Create a flashcard question and answer pair based on the following text (Format: Q: ...\nA: ...). Return ONLY the Q&A pair.",
};

async function callAi(apiKey: string, prompt: string): Promise<string> {
  const res = await fetch(geminiModelUrl(apiKey, "generateContent"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 4096 },
    }),
  });
  if (res.status === 429) throw new Error("RATE_LIMITED");
  if (!res.ok) throw geminiResponseError(res.status);
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let chargedUserId: string | null = null;
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(
      SUPABASE_URL,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, text } = await req.json();
    if (!text) {
      return new Response(JSON.stringify({ error: "No text provided" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const API_KEY = getGeminiApiKey("GEMINI_AI_ASSIST_API_KEY");
    const creditResult = await checkAndDeductServer(
      userData.user.id,
      "editor_ai_assist",
      SUPABASE_URL,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    if (!creditResult.allowed) {
      return creditLimitResponse("editor_ai_assist", creditResult, corsHeaders);
    }
    chargedUserId = userData.user.id;

    const actionInstruction = ACTION_PROMPTS[action] || `Perform "${action}" on the following text for study notes. Return ONLY the transformed text.`;
    const fullPrompt = `${actionInstruction}\n\nInput Text:\n"""\n${String(text).slice(0, 12000)}\n"""`;

    const result = await callAi(API_KEY, fullPrompt);
    if (!result.trim()) throw new Error("AI returned an empty editor result.");

    return new Response(JSON.stringify({ result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("editor-ai request failed");
    if (chargedUserId) {
      await refundServer(
        chargedUserId,
        1,
        "editor_ai_assist",
        geminiRefundReason(e),
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );
    }
    const isRateLimit = e.message === "RATE_LIMITED";
    return new Response(JSON.stringify({
      error: isRateLimit ? "Rate limited. Please try again in a moment." : "An unexpected error occurred.",
    }), {
      status: isRateLimit ? 429 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
