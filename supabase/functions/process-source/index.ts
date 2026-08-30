import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { geminiModelUrl, getGeminiApiKey } from "../_shared/gemini.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function extractFromUrl(url: string): Promise<string> {
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
  if (
    host === "localhost" || host === "0.0.0.0" || host.endsWith(".localhost") ||
    /^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) || /^169\.254\./.test(host) ||
    /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(host) ||
    host === "::1" || host === "[::1]" || host.startsWith("fc") ||
    host.startsWith("fd") || host.startsWith("fe80")
  ) {
    throw new Error("URL refers to a private network address");
  }

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

async function callGemini(apiKey: string, sysPrompt: string, userContent: string): Promise<string> {
  const res = await fetch(
    geminiModelUrl(apiKey, "generateContent"),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: sysPrompt }] },
        contents: [{ parts: [{ text: userContent }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 4096 },
      }),
    },
  );
  if (res.status === 429) throw new Error("Rate limited. Try again in a moment.");
  if (!res.ok) throw new Error(`Gemini error ${res.status}`);
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
}

async function extractDocumentWithGemini(apiKey: string, file: Blob, mimeType: string): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const uploadRes = await fetch(
    `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "X-Goog-Upload-Protocol": "raw",
        "X-Goog-Upload-Command": "start, upload, finalize",
        "X-Goog-Upload-Header-Content-Length": String(bytes.byteLength),
        "X-Goog-Upload-Header-Content-Type": mimeType,
        "Content-Type": mimeType,
      },
      body: bytes,
    },
  );
  if (!uploadRes.ok) throw new Error(`Gemini document upload failed: ${uploadRes.status}`);
  const uploadData = await uploadRes.json();
  const fileUri = uploadData?.file?.uri;
  if (!fileUri) throw new Error("Gemini did not return a document URI");
  const fileName = uploadData?.file?.name;
  if (fileName) {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const infoResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/${fileName}?key=${apiKey}`);
      if (infoResponse.ok) {
        const info = await infoResponse.json();
        if (info.state === "ACTIVE" || !info.state) break;
        if (info.state === "FAILED") throw new Error("Gemini could not process this document");
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  const response = await fetch(
    geminiModelUrl(apiKey, "generateContent"),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: "Extract the document text for editing. Preserve headings, paragraphs, list items, and meaningful line breaks. Return only the extracted text, with no summary or commentary." },
            { file_data: { mime_type: mimeType, file_uri: fileUri } },
          ],
        }],
        generationConfig: { temperature: 0, maxOutputTokens: 12000 },
      }),
    },
  );
  if (!response.ok) throw new Error(`Gemini document extraction failed: ${response.status}`);
  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
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

    const { sourceId } = await req.json();
    if (!sourceId) throw new Error("sourceId required");

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: source, error: sErr } = await admin
      .from("sources").select("*").eq("id", sourceId).eq("user_id", userId).maybeSingle();
    if (sErr || !source) throw new Error("Source not found");

    // Storage uses the account id as the first path segment. Keep this check
    // next to the service-role download so a malformed/legacy row cannot make
    // the processor read another account's upload.
    if (source.file_path && !source.file_path.startsWith(`${userId}/`)) {
      throw new Error("Source file ownership mismatch");
    }

    await admin
      .from("sources")
      .update({ status: "processing", error: null })
      .eq("id", sourceId)
      .eq("user_id", userId);

    let text = source.extracted_text || "";

    try {
      if (!text && source.kind === "url" && source.source_url) {
        text = await extractFromUrl(source.source_url);
      } else if (!text && source.kind === "youtube" && source.source_url) {
        text = await extractFromUrl(source.source_url);
      } else if (!text && source.file_path) {
        const { data: file, error: dErr } = await admin.storage.from("uploads").download(source.file_path);
        if (dErr || !file) throw new Error("Could not read uploaded file");

        const lowerName = (source.title ?? "").toLowerCase();
        const isAudio   = /\.(mp3|wav|m4a|aac|ogg|flac)$/.test(lowerName);
        const isVideo   = /\.(mp4|mov|webm|mkv)$/.test(lowerName);
        const isPdf     = /\.pdf$/.test(lowerName);
        const isWord    = /\.(doc|docx)$/.test(lowerName);

        if (isAudio || isVideo) {
          // Gemini Files API — upload then transcribe
          const buf       = await file.arrayBuffer();
          const mimeType  = isAudio ? "audio/mpeg" : "video/mp4";
          const MAX_BYTES = 120 * 1024 * 1024; // 120 MB hard cap
          if (buf.byteLength > MAX_BYTES) throw new Error("File too large — max 120 MB for audio/video");

          // 1. Upload to Gemini Files API
          const uploadRes = await fetch(
            `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${GEMINI_API_KEY}`,
            {
              method: "POST",
              headers: {
                "X-Goog-Upload-Protocol": "raw",
                "X-Goog-Upload-Command": "start, upload, finalize",
                "X-Goog-Upload-Header-Content-Length": String(buf.byteLength),
                "X-Goog-Upload-Header-Content-Type": mimeType,
                "Content-Type": mimeType,
              },
              body: buf,
            },
          );
          if (!uploadRes.ok) throw new Error(`Gemini file upload failed: ${uploadRes.status}`);
          const uploadData = await uploadRes.json();
          const fileUri    = uploadData?.file?.uri;
          if (!fileUri) throw new Error("Gemini did not return a file URI");

          // 2. Transcribe via generate-content with the file part
          const transcribeRes = await fetch(
            geminiModelUrl(GEMINI_API_KEY, "generateContent"),
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{
                  parts: [
                    { text: "Please transcribe this audio/video in full, preserving all spoken words as accurately as possible. Return only the transcript with no commentary." },
                    { file_data: { mime_type: mimeType, file_uri: fileUri } },
                  ],
                }],
                generationConfig: { temperature: 0, maxOutputTokens: 8192 },
              }),
            },
          );
          if (!transcribeRes.ok) throw new Error(`Gemini transcription failed: ${transcribeRes.status}`);
          const transcribeData = await transcribeRes.json();
          text = transcribeData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
          if (!text) throw new Error("Transcription returned empty — try a shorter clip");

        } else if (isPdf || isWord) {
          const mimeType = isPdf
            ? "application/pdf"
            : lowerName.endsWith(".doc")
              ? "application/msword"
              : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
          text = await extractDocumentWithGemini(GEMINI_API_KEY, file, mimeType);
        } else if (source.kind === "txt") {
          text = await file.text();
        } else {
          const buf = new Uint8Array(await file.arrayBuffer());
          const decoded = new TextDecoder("utf-8", { fatal: false }).decode(buf);
          text = decoded.replace(/[^\x20-\x7E\n\r\t]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 60000);
        }
      }

      if (!text || text.length < 20) throw new Error("Could not extract meaningful text from source");

      const sysPrompt = `You are an expert study assistant. Read the following source and produce a concise, well-structured summary (markdown, max ~400 words) capturing the key concepts, definitions, and takeaways a student should remember.`;
      const summary = await callGemini(GEMINI_API_KEY, sysPrompt, text.slice(0, 30000));

      await admin.from("sources").update({
        status: "ready",
        extracted_text: text.slice(0, 100000),
        summary,
      }).eq("id", sourceId).eq("user_id", userId);

      return new Response(JSON.stringify({ ok: true, summary }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (innerErr) {
      const msg = innerErr instanceof Error ? innerErr.message : "Unknown error";
      await admin
        .from("sources")
        .update({ status: "failed", error: msg })
        .eq("id", sourceId)
        .eq("user_id", userId);
      throw innerErr;
    }
  } catch (e) {
    console.error("process-source error:", e);
    return new Response(JSON.stringify({ error: "An unexpected error occurred." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
