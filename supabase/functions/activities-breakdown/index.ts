import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { checkAndDeductServer, creditLimitResponse, refundServer } from "../_shared/credits.ts";
import { geminiModelUrl, getGeminiApiKey } from "../_shared/gemini.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function callAi(apiKey: string, prompt: string): Promise<string> {
  const res = await fetch(geminiModelUrl(apiKey, "generateContent"), {
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
  });
  if (res.status === 429) throw new Error("RATE_LIMITED");
  if (!res.ok) throw new Error(`Gemini error ${res.status}: ${(await res.text()).slice(0, 300)}`);
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

    const { documentText, fileName } = await req.json();
    const safeText = String(documentText || "").slice(0, 25000);

    if (!safeText.trim()) {
      return new Response(JSON.stringify({ error: "No document text provided" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const API_KEY = getGeminiApiKey("GEMINI_ACTIVITIES_API_KEY");
    const creditResult = await checkAndDeductServer(
      userData.user.id,
      "activities_breakdown",
      SUPABASE_URL,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    if (!creditResult.allowed) {
      return creditLimitResponse("activities_breakdown", creditResult, corsHeaders);
    }
    chargedUserId = userData.user.id;

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

    if (!Array.isArray(activities) || activities.length === 0) {
      throw new Error("AI returned no activity breakdown.");
    }

    return new Response(JSON.stringify({ activities }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("activities-breakdown error:", e);
    if (chargedUserId) {
      await refundServer(
        chargedUserId,
        1,
        "activities_breakdown",
        e?.message || "Syllabus breakdown failed",
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
