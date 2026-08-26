import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { checkAndDeductServer, creditLimitResponse } from "../_shared/credits.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function callAi(apiKey: string, prompt: string): Promise<string> {
  const models = ["gemini-3.1-flash-lite", "gemini-2.5-flash-lite", "gemini-2.0-flash-lite", "gemini-1.5-flash-lite"];
  let lastErr = "";
  for (const model of models) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.4,
              maxOutputTokens: 8192,
              responseMimeType: "application/json",
            },
          }),
        },
      );
      if (res.status === 429) throw new Error("RATE_LIMITED");
      if (res.ok) {
        const data = await res.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
      }
      lastErr = await res.text();
    } catch (e: any) {
      if (e.message === "RATE_LIMITED") throw e;
      lastErr = e.message;
    }
  }
  throw new Error(`AI generation error: ${lastErr.slice(0, 300)}`);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

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

    const API_KEY =
      Deno.env.get("GEMINI_FLASHCARDS_API_KEY") ??
      Deno.env.get("GEMINI_API_KEY") ??
      Deno.env.get("GOOGLE_GEMINI_API_KEY");
    if (!API_KEY) throw new Error("GEMINI_FLASHCARDS_API_KEY is not configured");

    // ── Credit Check ──
    const creditResult = await checkAndDeductServer(
      userData.user.id,
      "generate_flashcards",
      SUPABASE_URL,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    if (!creditResult.allowed) {
      return creditLimitResponse("generate_flashcards", creditResult, corsHeaders);
    }

    const { sourceText, subject, count = 10 } = await req.json();
    const safeCount = Math.min(Math.max(Number(count) || 10, 3), 30);
    const safeSubject = String(subject || "General Study").slice(0, 200);
    const safeText = String(sourceText || "").slice(0, 20000);

    if (!safeText.trim()) {
      return new Response(JSON.stringify({ error: "No study notes provided" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prompt = `You are an expert tutor creating study flashcards using spaced repetition principles.
Based on the following notes about "${safeSubject}", generate exactly ${safeCount} high-yield flashcard question-and-answer pairs.

Rules:
- Questions must be clear, concise, and test active recall of specific concepts, definitions, formulas, or key ideas.
- Answers must be comprehensive, accurate, and easy to memorize (1 to 4 sentences).
- Return ONLY valid JSON in this exact structure:
[
  { "question": "...", "answer": "..." }
]

Notes:
"""
${safeText}
"""`;

    const rawJson = await callAi(API_KEY, prompt);
    let cards = [];
    try {
      const match = rawJson.match(/\[[\s\S]*\]/);
      cards = JSON.parse(match ? match[0] : rawJson);
    } catch {
      cards = [];
    }

    if (!Array.isArray(cards) || cards.length === 0) {
      throw new Error("Failed to parse flashcards from AI output");
    }

    return new Response(JSON.stringify({ cards }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("generate-flashcards error:", e);
    const isRateLimit = e.message === "RATE_LIMITED";
    return new Response(JSON.stringify({
      error: isRateLimit ? "Rate limited. Please try again in a moment." : "An unexpected error occurred.",
    }), {
      status: isRateLimit ? 429 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
