import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { checkAndDeductServer, creditLimitResponse, refundServer, MeteredAction } from "../_shared/credits.ts";
import { geminiModelUrl, getGeminiApiKey } from "../_shared/gemini.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Mode = "notes" | "flashcards" | "quiz" | "activities";

function buildPrompt(mode: Mode, count: number): string {
  if (mode === "notes") {
    return `You are an expert study note-taker. From the source text produce comprehensive study notes in clean markdown. Use clear headings, bullet points, bold key terms, and short examples. Focus on what a student must remember. Return ONLY the markdown — no extra commentary.`;
  }
  if (mode === "flashcards") {
    return `You are a flashcard generator. Create exactly ${count} high-quality Q&A flashcards from the source. Return ONLY valid JSON — no markdown fences: {"cards":[{"question":"...","answer":"..."}]}`;
  }
  if (mode === "activities") {
    return `You are a study work-breakdown generator. Analyse this academic source (syllabus, course outline, assignment brief, or study material) and extract a structured semester/project work breakdown.

Return ONLY valid JSON — no markdown fences:
{
  "activities": [
    {
      "title": "Unit 3 — Algorithms & Complexity",
      "subject": "Computer Science",
      "description": "Optional 1-sentence context",
      "tasks": ["Read Chapter 5", "Complete practice problems", "Review lecture slides", "Take self-quiz"]
    }
  ]
}

Rules:
- One activity per detected unit, module, week, or assignment (max 12).
- Each activity must have 3–8 specific, actionable tasks.
- Infer subject from the document title or content.
- Return ONLY the JSON object — nothing else.`;
  }
  // quiz
  return `You are a quiz generator. Create exactly ${count} multiple-choice questions from the source. Each must have 4 options and one correct index. Return ONLY valid JSON — no markdown fences: {"questions":[{"question":"...","options":["A","B","C","D"],"correct":0}]}`;
}

async function callGemini(apiKey: string, prompt: string, userContent: string): Promise<string> {
  const res = await fetch(
    geminiModelUrl(apiKey, "generateContent"),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${prompt}\n\n${userContent}` }] }],
        generationConfig: { temperature: 0.5, maxOutputTokens: 8192 },
      }),
    },
  );
  if (res.status === 429) throw new Error("RATE_LIMITED");
  if (!res.ok) throw new Error(`Gemini error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

function extractJson(s: string): any {
  const m = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = (m ? m[1] : s).trim();
  return JSON.parse(raw);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let chargedUserId: string | null = null;
  let chargedAction: MeteredAction | null = null;
  try {
    const SUPABASE_URL  = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const GEMINI_API_KEY = getGeminiApiKey("GEMINI_SOURCE_API_KEY");

    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const { sourceId, mode, count } = await req.json() as { sourceId: string; mode: Mode; count?: number };
    if (!sourceId || !mode) throw new Error("sourceId and mode required");
    const n = Math.min(Math.max(count || 10, 3), 25);

    const actionMap: Record<Mode, MeteredAction> = {
      flashcards: "generate_flashcards",
      quiz: "generate_exam",
      activities: "activities_breakdown",
      notes: "source_processing",
    };
    const creditAction = actionMap[mode] || "source_processing";

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: source } = await admin
      .from("sources").select("*").eq("id", sourceId).eq("user_id", userId).maybeSingle();
    if (!source) throw new Error("Source not found");
    if (source.status !== "ready" || !source.extracted_text) throw new Error("Source is not processed yet");

    const creditResult = await checkAndDeductServer(
      userId,
      creditAction,
      SUPABASE_URL,
      SERVICE_KEY,
    );
    if (!creditResult.allowed) {
      return creditLimitResponse(creditAction, creditResult, corsHeaders);
    }
    chargedUserId = userId;
    chargedAction = creditAction;

    let content: string;
    try {
      content = await callGemini(
        GEMINI_API_KEY,
        buildPrompt(mode, n),
        `Source title: ${source.title}\n\nSource content:\n${source.extracted_text.slice(0, 30000)}`,
      );
    } catch (e: any) {
      if (e.message === "RATE_LIMITED") {
        throw e;
      }
      throw e;
    }

    // ── notes ──────────────────────────────────────────────────────────────
    if (mode === "notes") {
      const { data: note, error } = await admin.from("notes").insert({
        user_id: userId, title: `Notes — ${source.title}`, content,
      }).select().single();
      if (error) throw error;
      return new Response(JSON.stringify({ ok: true, mode, note }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── flashcards ─────────────────────────────────────────────────────────
    if (mode === "flashcards") {
      const parsed = extractJson(content);
      const cards = (parsed.cards || []).slice(0, n).map((c: any) => ({
        user_id: userId,
        question: String(c.question || "").slice(0, 1000),
        answer:   String(c.answer   || "").slice(0, 2000),
      })).filter((c: any) => c.question && c.answer);
      if (!cards.length) throw new Error("AI returned no flashcards");
      const { error } = await admin.from("flashcards").insert(cards);
      if (error) throw error;
      return new Response(JSON.stringify({ ok: true, mode, count: cards.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── activities (syllabus import) ───────────────────────────────────────
    // Returns the parsed breakdown to the frontend for user review — does NOT
    // persist automatically. The frontend saves after the user confirms.
    if (mode === "activities") {
      const parsed = extractJson(content);
      const activities = (parsed.activities || []).slice(0, 12).map((a: any) => ({
        title:       String(a.title       || "").slice(0, 200),
        subject:     String(a.subject     || "").slice(0, 100),
        description: String(a.description || "").slice(0, 500),
        tasks:       (Array.isArray(a.tasks) ? a.tasks : []).slice(0, 8).map((t: any) => String(t).slice(0, 300)),
      })).filter((a: any) => a.title && a.tasks.length > 0);
      if (!activities.length) throw new Error("AI returned no activities");
      return new Response(JSON.stringify({ ok: true, mode, activities }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── quiz ───────────────────────────────────────────────────────────────
    const parsed = extractJson(content);
    const rows = (parsed.questions || []).slice(0, n).map((q: any) => ({
      user_id:        userId,
      question:       String(q.question || "").slice(0, 1000),
      options:        Array.isArray(q.options) ? q.options.slice(0, 4) : [],
      correct_answer: Number.isInteger(q.correct) ? q.correct : 0,
    })).filter((q: any) => q.question && q.options.length === 4);
    if (!rows.length) throw new Error("AI returned no quiz questions");
    const { error } = await admin.from("quizzes").insert(rows);
    if (error) throw error;
    return new Response(JSON.stringify({ ok: true, mode, count: rows.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e: any) {
    console.error("generate-from-source error:", e);
    if (chargedUserId && chargedAction) {
      await refundServer(
        chargedUserId,
        1,
        chargedAction,
        e?.message || "Source generation failed",
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );
    }
    return new Response(JSON.stringify({ error: "An unexpected error occurred." }), {
      status: e?.message === "RATE_LIMITED" ? 429 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
