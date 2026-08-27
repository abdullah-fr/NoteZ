import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { checkAndDeductServer, creditLimitResponse, refundServer } from "../_shared/credits.ts";
import { geminiModelUrl, getGeminiApiKey } from "../_shared/gemini.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DYNAMIC_GUIDELINES = `
CRITICAL INSTRUCTIONS FOR FORMATTING, STRUCTURE & RELEVANCE:
- FOLLOW-UP PROMPTS (MANDATORY AT THE END):
  * At the very end of EVERY response, add a section containing exactly 3 highly specific, relevant follow-up questions or next study choices tailored to the content just generated.
  * Format them strictly at the end of your response like this:
    ---
    NEXT_FOLLOW_UPS:
    - [Specific follow-up question 1 based on topic]
    - [Specific follow-up question 2 based on topic]
    - [Specific follow-up question 3 based on topic]
- DYNAMIC BRAND MODERATION & DELETION OF CANNED RESPONSES:
  * You are NoteZ AI — an intelligent, friendly study and academic assistant built for the NoteZ workspace.
  * Your primary focus is helping students learn: class notes, academic concepts, exam prep, flashcards, study schedules, and workspace tasks.
  * IF THE USER ASKS AN OFF-TOPIC, EXPLICIT, OFFENSIVE, OR COMPLETELY NON-EDUCATIONAL QUESTION (e.g., explicit/adult content, profanity, cooking, gaming, sports, general trivia, personal chat):
    - DO NOT use any fixed, hardcoded, or repetitive canned responses. NEVER repeat the exact same sentence multiple times.
    - Instead, dynamically write a natural, polite, unique 1-2 sentence response tailored specifically to what the user asked.
    - Acknowledge their message naturally, explain politely that as NoteZ AI you're tailored for academic and study help, and suggest a creative study query or workspace feature they can try next.
    - Keep every refusal unique, fresh, friendly, and contextual.
  * Casual greetings ("hi", "hello", "hey", "how are you") ARE allowed — greet them warmly in 1 short sentence and ask what they're studying today.
- FORMATTING & LAYOUT (Crucial):
  * For study guides, explanations, and summaries, always use structured Markdown with clear hierarchy:
    - Main numbered section headers: "### 1. Section Title", "### 2. Section Title"
    - Bullet points with bold lead-ins for key points: "- **Key Concept / Term:** Clear, detailed explanation."
    - Highlight key terms with bold text (\`**term**\`) for scannability.
    - For summaries, include an initial overview sentence/paragraph, structured sections with bullets, and a final summary callout:
      "> **In one sentence / Key Takeaway:** Core summary here."
    - Ensure clean blank lines between headers, paragraphs, and lists so text never looks cramped or plain.
- GREETINGS & CASUAL CHAT: If the user says "hello", "hi", "hey", or casual greetings, respond naturally and warmly in ONE OR TWO short sentences (e.g., "Hello! How can I help you with your studies or notes today?"). DO NOT output long unprompted introductions or essays.
- DIRECT ANSWERS: Answer questions directly without generic opening filler ("Sure, I can help with that", "Hello, I am NoteZ AI").
- DIRECT CITATION: When study context, folders, or notes are provided in the prompt, base your responses directly on them. DO NOT tell the user to upload or paste notes.
`;

const MODE_PROMPTS: Record<string, string> = {
  researcher: `You are NoteZ AI Researcher — an analytical, deep research assistant. Provide thorough, evidence-backed breakdowns with structured sections. ${DYNAMIC_GUIDELINES}`,
  summarizer: `You are NoteZ AI Summarizer — distill content into beautifully structured summaries with numbered sections, bold bullet points, and an impactful key takeaway. ${DYNAMIC_GUIDELINES}`,
  analyst: `You are NoteZ AI Analyst — evaluate arguments, trade-offs, pros/cons, and critical frameworks with structured tables or bullet comparisons. ${DYNAMIC_GUIDELINES}`,
};

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

    const { conversationId, message, context = "", mode = "researcher", sourceId, scope = "general" } = await req.json();
    if (!conversationId || !message) {
      return new Response(JSON.stringify({ error: "Missing conversationId or message" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const GEMINI_API_KEY = getGeminiApiKey("GEMINI_CHAT_API_KEY");
    const creditResult = await checkAndDeductServer(
      user.id,
      "ai_chat",
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    if (!creditResult.allowed) {
      return creditLimitResponse("ai_chat", creditResult, corsHeaders);
    }
    chargedUserId = user.id;

    // Load history
    const { data: history } = await supabase
      .from("chat_messages")
      .select("role, content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(50);

    // Persist the current message after loading history so Gemini receives it
    // exactly once in the final contents array below.
    await supabase.from("chat_messages").insert({
      conversation_id: conversationId,
      user_id: user.id,
      role: "user",
      content: message,
    });

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

    const scopeNote = scope && scope !== "general"
      ? `\n\n[STUDY CONTEXT SCOPE: "${scope}". The user is focusing on this specific context. If notes or source excerpts are provided in the conversation, use and summarize them directly to answer the user's prompt without asking them to re-upload or re-paste.]`
      : "";

    const systemPrompt = (MODE_PROMPTS[mode] || MODE_PROMPTS.researcher) + sourceContext + scopeNote;

    // Build conversation turns for Gemini
    const turns = (history || []).map((m: any) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    // Gemini streaming via SSE. geminiModelUrl always targets
    // gemini-3.1-flash-lite; do not fall back to retired model IDs.
    const geminiRes = await fetch(
      `${geminiModelUrl(GEMINI_API_KEY, "streamGenerateContent")}&alt=sse`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [
            ...turns,
            { role: "user", parts: [{ text: `${message}${String(context || "").slice(0, 16000)}` }] },
          ],
          generationConfig: { temperature: 0.7, maxOutputTokens: 4096 },
        }),
      },
    );
    if (geminiRes.status === 429) {
      throw new Error("RATE_LIMITED");
    }
    if (!geminiRes.ok || !geminiRes.body) {
      throw new Error(`Gemini streaming error ${geminiRes.status}: ${(await geminiRes.text()).slice(0, 300)}`);
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
          } else if (chargedUserId) {
            await refundServer(
              chargedUserId,
              1,
              "ai_chat",
              "AI chat returned no content",
              Deno.env.get("SUPABASE_URL")!,
              Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
            );
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
    const code = e instanceof Error ? e.message : String(e);
    const providerUnavailable = code === "GEMINI_ACCESS_DENIED";
    if (chargedUserId) {
      await refundServer(
        chargedUserId,
        1,
        "ai_chat",
        code || "AI chat failed",
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );
    }
    return new Response(JSON.stringify({
      error: providerUnavailable
        ? "AI provider access is unavailable. Check the Gemini API project key."
        : code === "RATE_LIMITED"
        ? "Rate limit exceeded. Try again shortly."
        : "An unexpected error occurred.",
      code: providerUnavailable ? code : undefined,
    }), {
      status: providerUnavailable ? 503 : code === "RATE_LIMITED" ? 429 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
