import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function extractFromUrl(url: string): Promise<string> {
  // SSRF protection: only allow http(s) URLs to public hostnames.
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Invalid URL");
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("Only http(s) URLs are allowed");
  }
  const host = parsed.hostname.toLowerCase();
  // Block localhost, private IPv4 ranges, link-local, and IPv6 loopback/private.
  if (
    host === "localhost" ||
    host === "0.0.0.0" ||
    host.endsWith(".localhost") ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(host) ||
    host === "::1" ||
    host === "[::1]" ||
    host.startsWith("fc") ||
    host.startsWith("fd") ||
    host.startsWith("fe80")
  ) {
    throw new Error("URL refers to a private network address");
  }

  // YouTube → use oEmbed for title + description fallback
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
  if (yt) {
    try {
      const r = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`);
      const j = await r.json();
      return `YouTube video: ${j.title}\nAuthor: ${j.author_name}\nURL: ${url}\n\n(Transcript not available — AI will summarize from title/context.)`;
    } catch {
      return `YouTube URL: ${url}`;
    }
  }
  // Generic web page: fetch and strip HTML
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 NoteZBot" } });
  const html = await res.text();
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.slice(0, 60000);
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

    const { sourceId } = await req.json();
    if (!sourceId) throw new Error("sourceId required");

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: source, error: sErr } = await admin
      .from("sources").select("*").eq("id", sourceId).eq("user_id", userId).maybeSingle();
    if (sErr || !source) throw new Error("Source not found");

    await admin.from("sources").update({ status: "processing", error: null }).eq("id", sourceId);

    let text = source.extracted_text || "";

    try {
      if (!text && source.kind === "url" && source.source_url) {
        text = await extractFromUrl(source.source_url);
      } else if (!text && source.kind === "youtube" && source.source_url) {
        text = await extractFromUrl(source.source_url);
      } else if (!text && source.file_path) {
        // Download file from private bucket
        const { data: file, error: dErr } = await admin.storage.from("uploads").download(source.file_path);
        if (dErr || !file) throw new Error("Could not read uploaded file");
        if (source.kind === "txt") {
          text = await file.text();
        } else {
          // PDF/DOCX: best-effort plain text decode (binary files become noisy);
          // we still pass the raw text snippet to the AI which is robust.
          const buf = new Uint8Array(await file.arrayBuffer());
          // Try utf-8 decode of printable runs
          const decoded = new TextDecoder("utf-8", { fatal: false }).decode(buf);
          text = decoded.replace(/[^\x20-\x7E\n\r\t]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 60000);
        }
      }

      if (!text || text.length < 20) throw new Error("Could not extract meaningful text from source");

      // Summarize
      const sysPrompt = `You are an expert study assistant. Read the following source and produce a concise, well-structured summary (markdown, max ~400 words) capturing the key concepts, definitions, and takeaways a student should remember.`;
      const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: sysPrompt },
            { role: "user", content: text.slice(0, 30000) },
          ],
        }),
      });
      if (aiRes.status === 429) throw new Error("Rate limited. Try again in a moment.");
      if (aiRes.status === 402) throw new Error("AI credits exhausted.");
      if (!aiRes.ok) throw new Error(`AI gateway error ${aiRes.status}`);
      const aiData = await aiRes.json();
      const summary = aiData.choices?.[0]?.message?.content?.trim() || "";

      await admin.from("sources").update({
        status: "ready",
        extracted_text: text.slice(0, 100000),
        summary,
      }).eq("id", sourceId);

      return new Response(JSON.stringify({ ok: true, summary }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (innerErr) {
      const msg = innerErr instanceof Error ? innerErr.message : "Unknown error";
      await admin.from("sources").update({ status: "failed", error: msg }).eq("id", sourceId);
      throw innerErr;
    }
  } catch (e) {
    console.error("process-source error:", e);
    return new Response(JSON.stringify({ error: "An unexpected error occurred." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});