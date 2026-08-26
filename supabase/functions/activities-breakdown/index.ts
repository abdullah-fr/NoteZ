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
              temperature: 0.3,
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

    const API_KEY = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_GEMINI_API_KEY");
    if (!API_KEY) throw new Error("AI service API key is not configured");

    // ── Credit Check ──
    const creditResult = await checkAndDeductServer(
      userData.user.id,
      "activities_breakdown",
      SUPABASE_URL,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    if (!creditResult.allowed) {
      return creditLimitResponse("activities_breakdown", creditResult, corsHeaders);
    }

    const { documentText, fileName } = await req.json();
    const safeText = String(documentText || "").slice(0, 25000);

    if (!safeText.trim()) {
      return new Response(JSON.stringify({ error: "No document text provided" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prompt = `You are an expert academic project and task breakdown assistant.
Analyze the following document (syllabus, assignment rubric, project requirements, or course guidelines):

Document Name: "${String(fileName || 'Uploaded Document').slice(0, 100)}"
Document Content:
"""
${safeText}
"""

Break this document down into actionable study activities and checklists.
Output strict JSON with this exact schema:
{
  "activities": [
    {
      "title": "Clear, concise activity or assignment title",
      "subject": "Inferred course/subject name or General",
      "description": "Short 1-2 sentence context or due date note",
      "tasks": [
        "Actionable step 1",
        "Actionable step 2",
        "Actionable step 3"
      ]
    }
  ]
}`;

    const rawJson = await callAi(API_KEY, prompt);
    let activities = [];
    try {
      const parsed = JSON.parse(rawJson);
      activities = Array.isArray(parsed.activities) ? parsed.activities : Array.isArray(parsed) ? parsed : [];
    } catch {
      const match = rawJson.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          const parsed = JSON.parse(match[0]);
          activities = parsed.activities || [];
        } catch {
          activities = [];
        }
      }
    }

    return new Response(JSON.stringify({ activities }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("activities-breakdown error:", e);
    const isRateLimit = e.message === "RATE_LIMITED";
    return new Response(JSON.stringify({
      error: isRateLimit ? "Rate limited. Please try again in a moment." : "An unexpected error occurred.",
    }), {
      status: isRateLimit ? 429 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
