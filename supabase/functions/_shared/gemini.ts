/**
 * Shared Gemini configuration for all NoteZ Edge Functions.
 *
 * Gemini keys are server-side secrets. The first name is feature-specific when
 * one is supplied; the remaining names keep older deployments compatible.
 */

export const GEMINI_MODEL = "gemini-3.1-flash-lite";

const FALLBACK_KEY_NAMES = [
  "GEMINI_API_KEY",
  "GOOGLE_GEMINI_API_KEY",
  "GEMINI_CHAT_API_KEY",
  "GEMINI_EXAM_API_KEY",
  "GEMINI_FLASHCARDS_API_KEY",
  "GEMINI_AI_ASSIST_API_KEY",
  "GEMINI_ACTIVITIES_API_KEY",
  "GEMINI_SOURCE_API_KEY",
];

/** Resolve a configured server-side Gemini key without exposing its value. */
export function getGeminiApiKey(...preferredNames: string[]): string {
  const names = [...new Set([...preferredNames, ...FALLBACK_KEY_NAMES])];

  for (const name of names) {
    const value = Deno.env.get(name)?.trim();
    if (value) return value;
  }

  throw new Error("GEMINI_API_KEY is not configured");
}

export function geminiModelUrl(apiKey: string, operation: string): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:${operation}?key=${apiKey}`;
}
