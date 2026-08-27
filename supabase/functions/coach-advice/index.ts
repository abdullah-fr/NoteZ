import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { geminiModelUrl, getGeminiApiKey } from "../_shared/gemini.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function callGemini(apiKey: string, prompt: string, context: unknown): Promise<string> {
  const res = await fetch(
    geminiModelUrl(apiKey, "generateContent"),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${prompt}\n\nContext data:\n${JSON.stringify(context)}` }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
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
    const { type, context } = await req.json();

    const GEMINI_API_KEY = getGeminiApiKey("GEMINI_CHAT_API_KEY");

    let systemPrompt = "";

    if (type === "study-guidance") {
      systemPrompt = `You are COACH — a strict but smart mentor who tracks, pushes, and guides students. You're direct, motivating, and data-driven.

Given the student's current study context, provide:
1. A motivational but firm message (1-2 sentences)
2. 3 specific actionable suggestions based on their activity
3. A micro-learning tip if they're short on time

Be concise. Use emojis sparingly. Sound like a real coach, not an AI.
Return ONLY valid JSON — no markdown fences:
{
  "message": "Main coaching message",
  "suggestions": ["suggestion1", "suggestion2", "suggestion3"],
  "microTip": "Quick 5-min activity suggestion",
  "mood": "encouraging"
}`;
    } else if (type === "progress-analysis") {
      systemPrompt = `You are COACH — analyze this student's progress data and provide insights.

Return ONLY valid JSON — no markdown fences:
{
  "learningSpeed": "fast",
  "retentionRate": "high",
  "consistencyScore": 75,
  "strongAreas": ["area1", "area2"],
  "weakAreas": ["area1", "area2"],
  "recommendations": ["rec1", "rec2", "rec3"],
  "overallMessage": "Personalized message about their progress"
}`;
    } else if (type === "behavioral-coaching") {
      systemPrompt = `You are COACH — detect patterns in the student's behavior and provide behavioral coaching.

Be strict but caring. If they've been lazy, call it out firmly but supportively.
Return ONLY valid JSON — no markdown fences:
{
  "pattern": "Description of detected pattern",
  "severity": "mild",
  "message": "Coaching message addressing the behavior",
  "actionPlan": ["step1", "step2", "step3"],
  "reminder": "A push notification style reminder"
}`;
    }

    let content: string;
    try {
      content = await callGemini(GEMINI_API_KEY, systemPrompt, context);
    } catch (e: any) {
      if (e.message === "RATE_LIMITED") {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again." }), {
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
      console.error("Failed to parse coach response:", content);
      parsed = { message: content, suggestions: [], microTip: "", mood: "encouraging" };
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("coach-advice error:", e);
    return new Response(JSON.stringify({ error: "An unexpected error occurred." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
