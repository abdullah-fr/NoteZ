import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { type, context } = await req.json();
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");

    let systemPrompt = "";

    if (type === "study-guidance") {
      systemPrompt = `You are COACH — a strict but smart mentor who tracks, pushes, and guides students. You're direct, motivating, and data-driven.

Given the student's current study context, provide:
1. A motivational but firm message (1-2 sentences)
2. 3 specific actionable suggestions based on their activity
3. A micro-learning tip if they're short on time

Be concise. Use emojis sparingly. Sound like a real coach, not an AI.
Return JSON:
{
  "message": "Main coaching message",
  "suggestions": ["suggestion1", "suggestion2", "suggestion3"],
  "microTip": "Quick 5-min activity suggestion",
  "mood": "encouraging" | "firm" | "celebratory" | "concerned"
}`;
    } else if (type === "progress-analysis") {
      systemPrompt = `You are COACH — analyze this student's progress data and provide insights.

Return JSON:
{
  "learningSpeed": "fast" | "moderate" | "slow",
  "retentionRate": "high" | "medium" | "low",
  "consistencyScore": number (0-100),
  "strongAreas": ["area1", "area2"],
  "weakAreas": ["area1", "area2"],
  "recommendations": ["rec1", "rec2", "rec3"],
  "overallMessage": "Personalized message about their progress"
}`;
    } else if (type === "behavioral-coaching") {
      systemPrompt = `You are COACH — detect patterns in the student's behavior and provide behavioral coaching.

Be strict but caring. If they've been lazy, call it out firmly but supportively.
Return JSON:
{
  "pattern": "Description of detected pattern",
  "severity": "mild" | "moderate" | "serious",
  "message": "Coaching message addressing the behavior",
  "actionPlan": ["step1", "step2", "step3"],
  "reminder": "A push notification style reminder"
}`;
    }

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
          { role: "user", content: JSON.stringify(context) },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
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
