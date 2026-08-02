import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const STRUCTURED_FORMAT = `
IMPORTANT — Always structure your response using these exact markdown headings when applicable:

## Answer
[Your main response here — clear, direct, and well-formatted]

## Material Used
[Cite the specific notes, folder content, quiz results, or source material you drew from. If no platform material is available, say "Based on general knowledge — no platform material was attached."]

## Next Actions
[3–5 specific, actionable next steps the learner should take to deepen understanding or apply this knowledge]

This structure is mandatory. It helps learners understand not just the answer, but where it came from and what to do next.
`;

const MODE_PROMPTS: Record<string, string> = {
  tutor: `You are TUTOR — a brilliant, patient teacher inside a study platform. Explain concepts clearly with analogies, simple examples, and step-by-step reasoning. When a context scope is provided (folder, quiz, exam), keep your answer tightly bounded to that material. ${STRUCTURED_FORMAT}`,
  researcher: `You are RESEARCHER — an analytical assistant for deep research inside a study platform. Be precise, cite provided source material when available, and clearly distinguish facts from inference. When a context scope is provided, draw only from that context. ${STRUCTURED_FORMAT}`,
  summarizer: `You are SUMMARIZER — distill content into the clearest, shortest useful form. When a context scope is provided, summarize only that material. Default: 1-sentence TL;DR, then 3-7 key bullets. ${STRUCTURED_FORMAT}`,
  analyst: `You are ANALYST — a sharp critical thinker inside a study platform. Break problems into components, evaluate trade-offs, surface assumptions and risks. When a context scope is provided (e.g. quiz results), analyze only that data. ${STRUCTURED_FORMAT}`,
  mentor: `You are MENTOR — a supportive coach focused on the learner's growth inside a study platform. Be warm, encouraging, and Socratic. When a context scope is provided, tie advice directly to that material. ${STRUCTURED_FORMAT}`,
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured");

    const { conversationId, message, mode = "tutor", sourceId, scope = "general" } = await req.json();
    if (!conversationId || !message) {
      return new Response(JSON.stringify({ error: "Missing conversationId or message" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Save user message
    await supabase.from("chat_messages").insert({
      conversation_id: conversationId,
      user_id: user.id,
      role: "user",
      content: message,
    });

    // Load history
    const { data: history } = await supabase
      .from("chat_messages")
      .select("role, content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(50);

    // Optional source context
    let sourceContext = "";
    if (sourceId) {
      const { data: src } = await supabase
        .from("sources")
        .select("title, summary, extracted_text")
        .eq("id", sourceId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (src) {
        const text = (src.extracted_text || "").slice(0, 12000);
        sourceContext = `\n\nThe user has attached the following source titled "${src.title}".\nSummary: ${src.summary || "(none)"}\n\nSource excerpt:\n${text}`;
      }
    }

    const scopeNote = scope !== "general"
      ? `\n\n[ACTIVE SCOPE: "${scope}" — Restrict your answer to material relevant to this scope. Always cite platform content in the "Material Used" section.]`
      : "";

    const systemPrompt = (MODE_PROMPTS[mode] || MODE_PROMPTS.tutor) + sourceContext + scopeNote;

    // Build conversation turns for Gemini
    const turns = (history || []).map((m: any) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    // Gemini streaming via SSE
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:streamGenerateContent?key=${GEMINI_API_KEY}&alt=sse`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [
            ...turns,
            { role: "user", parts: [{ text: message }] },
          ],
          generationConfig: { temperature: 0.7, maxOutputTokens: 4096 },
        }),
      },
    );

    if (geminiRes.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again shortly." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!geminiRes.ok || !geminiRes.body) {
      throw new Error(`Gemini error ${geminiRes.status}: ${await geminiRes.text()}`);
    }

    let fullText = "";
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const stream = new ReadableStream({
      async start(controller) {
        const reader = geminiRes.body!.getReader();
        let buffer = "";
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";
            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed.startsWith("data:")) continue;
              const data = trimmed.slice(5).trim();
              if (!data || data === "[DONE]") continue;
              try {
                const json = JSON.parse(data);
                const delta = json.candidates?.[0]?.content?.parts?.[0]?.text;
                if (delta) {
                  fullText += delta;
                  controller.enqueue(encoder.encode(delta));
                }
              } catch {
                // ignore partial lines
              }
            }
          }
        } catch (e) {
          console.error("Stream error", e);
        } finally {
          if (fullText) {
            await supabase.from("chat_messages").insert({
              conversation_id: conversationId,
              user_id: user.id,
              role: "assistant",
              content: fullText,
            });
            await supabase
              .from("chat_conversations")
              .update({ updated_at: new Date().toISOString() })
              .eq("id", conversationId);
          }
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
      },
    });
  } catch (e) {
    console.error("ai-chat error", e);
    return new Response(JSON.stringify({ error: "An unexpected error occurred." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
