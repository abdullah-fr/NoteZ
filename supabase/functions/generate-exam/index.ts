import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Require authenticated user
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

    const { subject, specialization, difficulty, questionCount } = await req.json();
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");

    const safeCount = Math.min(Math.max(Number(questionCount) || 5, 1), 25);
    const safeDifficulty = ["easy", "medium", "hard"].includes(String(difficulty)) ? difficulty : "medium";
    const safeSubject = String(subject || "").slice(0, 200);
    const safeSpec = specialization ? String(specialization).slice(0, 200) : "";

    const systemPrompt = `You are an expert exam generator for students. Generate exactly ${safeCount} multiple-choice questions about ${safeSubject}${safeSpec ? ` (specifically ${safeSpec})` : ''}.

Difficulty level: ${safeDifficulty}

For each question, provide:
- A clear, well-worded question
- 4 answer options (A, B, C, D)
- The index of the correct answer (0-3)
- A detailed explanation of why the correct answer is right
- An explanation of why each wrong answer is wrong
- A "better approach" tip for understanding the concept

Return ONLY valid JSON in this exact format, no other text:
{
  "questions": [
    {
      "question": "...",
      "options": ["A...", "B...", "C...", "D..."],
      "correctIndex": 0,
      "explanation": "The correct answer is A because...",
      "wrongExplanations": {
        "0": "...",
        "1": "This is wrong because...",
        "2": "This is wrong because...",
        "3": "This is wrong because..."
      },
      "betterApproach": "A tip for understanding this concept better..."
    }
  ]
}`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Generate ${safeCount} ${safeDifficulty}-difficulty exam questions about ${safeSubject}${safeSpec ? ` focusing on ${safeSpec}` : ''}.` },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      console.error("AI gateway error:", response.status, await response.text());
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    let parsed;
    try {
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonStr = jsonMatch ? jsonMatch[1].trim() : content.trim();
      parsed = JSON.parse(jsonStr);
    } catch {
      console.error("Failed to parse AI response:", content);
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
