import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Mode = "notes" | "flashcards" | "quiz";

function buildPrompt(mode: Mode, count: number) {
  if (mode === "notes") {
    return `You are an expert study note-taker. From the source text, produce comprehensive study notes in clean markdown. Use clear headings, bullet points, bold key terms, and short examples. Focus on what a student must remember. Return ONLY the markdown notes.`;
  }
  if (mode === "flashcards") {
    return `You are a flashcard generator. Create exactly ${count} high-quality Q&A flashcards from the source. Questions should test recall of important concepts. Return ONLY valid JSON: {"cards":[{"question":"...","answer":"..."}]}`;
  }
  return `You are a quiz generator. Create exactly ${count} multiple-choice questions from the source. Each must have 4 options and one correct index. Return ONLY valid JSON: {"questions":[{"question":"...","options":["A","B","C","D"],"correct":0}]}`;
}

function extractJson(s: string): any {
  const m = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = (m ? m[1] : s).trim();
  return JSON.parse(raw);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");

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

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: source } = await admin
      .from("sources").select("*").eq("id", sourceId).eq("user_id", userId).maybeSingle();
    if (!source) throw new Error("Source not found");
    if (source.status !== "ready" || !source.extracted_text) throw new Error("Source is not processed yet");

    const sys = buildPrompt(mode, n);
    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: sys },
          { role: "user", content: `Source title: ${source.title}\n\nSource content:\n${source.extracted_text.slice(0, 30000)}` },
        ],
      }),
    });
    if (aiRes.status === 429) return new Response(JSON.stringify({ error: "Rate limited." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (aiRes.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!aiRes.ok) throw new Error(`AI gateway error ${aiRes.status}`);
    const aiData = await aiRes.json();
    const content = aiData.choices?.[0]?.message?.content || "";

    if (mode === "notes") {
      const { data: note, error } = await admin.from("notes").insert({
        user_id: userId,
        title: `Notes — ${source.title}`,
        content,
      }).select().single();
      if (error) throw error;
      return new Response(JSON.stringify({ ok: true, mode, note }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (mode === "flashcards") {
      const parsed = extractJson(content);
      const cards = (parsed.cards || []).slice(0, n).map((c: any) => ({
        user_id: userId,
        question: String(c.question || "").slice(0, 1000),
        answer: String(c.answer || "").slice(0, 2000),
      })).filter((c: any) => c.question && c.answer);
      if (!cards.length) throw new Error("AI returned no flashcards");
      const { error } = await admin.from("flashcards").insert(cards);
      if (error) throw error;
      return new Response(JSON.stringify({ ok: true, mode, count: cards.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // quiz
    const parsed = extractJson(content);
    const rows = (parsed.questions || []).slice(0, n).map((q: any) => ({
      user_id: userId,
      question: String(q.question || "").slice(0, 1000),
      options: Array.isArray(q.options) ? q.options.slice(0, 4) : [],
      correct_answer: Number.isInteger(q.correct) ? q.correct : 0,
    })).filter((q: any) => q.question && q.options.length === 4);
    if (!rows.length) throw new Error("AI returned no quiz questions");
    const { error } = await admin.from("quizzes").insert(rows);
    if (error) throw error;
    return new Response(JSON.stringify({ ok: true, mode, count: rows.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("generate-from-source error:", e);
    return new Response(JSON.stringify({ error: "An unexpected error occurred." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});