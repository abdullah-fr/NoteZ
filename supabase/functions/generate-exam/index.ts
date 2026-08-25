import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { checkAndDeductServer, creditLimitResponse, refundServer } from "../_shared/credits.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function callGemini(apiKey: string, prompt: string, userMsg: string): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${prompt}\n\n${userMsg}` }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 8192 },
      }),
    },
  );
  if (res.status === 429) throw new Error("RATE_LIMITED");
  if (!res.ok) throw new Error(`Gemini error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
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

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured");

    // ── Credit Metering ──────────────────────────────────────────────────────
    const creditResult = await checkAndDeductServer(
      userData.user.id,
      "generate_exam",
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    if (!creditResult.allowed) {
      return creditLimitResponse("generate_exam", creditResult, corsHeaders);
    }
    // ─────────────────────────────────────────────────────────────────────────

    const { subject, specialization, difficulty, questionCount, sourceText } = await req.json();
    const safeCount = Math.min(Math.max(Number(questionCount) || 5, 1), 25);
    const safeDifficulty = ["easy", "medium", "hard"].includes(String(difficulty)) ? difficulty : "medium";
    const safeSubject = String(subject || "").slice(0, 200);
    const safeSpec = specialization ? String(specialization).slice(0, 200) : "";
    const safeSource = sourceText ? String(sourceText).slice(0, 10000) : "";

    const sourceBlock = safeSource
      ? `\n\nGenerate questions specifically based on the following student notes:\n${safeSource}`
      : "";

    const systemPrompt = `You are an expert exam generator for students. Generate exactly ${safeCount} multiple-choice questions about ${safeSubject}${safeSpec ? ` (specifically ${safeSpec})` : ""}${sourceBlock ? " — use the provided notes as your primary source" : ""}.

Difficulty level: ${safeDifficulty}

Return ONLY valid JSON — no markdown fences, no extra text:
{
  "questions": [
    {
      "question": "...",
      "options": ["A...", "B...", "C...", "D..."],
      "correctIndex": 0,
      "explanation": "The correct answer is A because...",
      "wrongExplanations": {
        "0": "why A is right or why it may seem wrong",
        "1": "This is wrong because...",
        "2": "This is wrong because...",
        "3": "This is wrong because..."
      },
      "betterApproach": "A tip for understanding this concept better..."
    }
  ]
}${sourceBlock}`;

    let content: string;
    try {
      content = await callGemini(
        GEMINI_API_KEY,
        systemPrompt,
        `Generate ${safeCount} ${safeDifficulty}-difficulty exam questions about ${safeSubject}${safeSpec ? ` focusing on ${safeSpec}` : ""}.`,
      );
    } catch (e: any) {
      if (e.message === "RATE_LIMITED") {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw e;
    }

    let parsed;
    try {
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonStr = jsonMatch ? jsonMatch[1].trim() : content.trim();
      parsed = JSON.parse(jsonStr);
    } catch {
      console.error("Failed to parse Gemini response:", content);
      return new Response(JSON.stringify({ error: "Failed to generate exam. Please try again." }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-exam error:", e);
    return new Response(JSON.stringify({ error: "An unexpected error occurred." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
