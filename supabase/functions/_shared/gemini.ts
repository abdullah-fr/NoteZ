/**
 * Shared Gemini configuration for all NoteZ Edge Functions.
 *
 * Gemini keys are server-side secrets. The first name is feature-specific when
 * one is supplied; the remaining names keep older deployments compatible.
 */

export const GEMINI_MODEL = "gemini-3.1-flash-lite";

export const GEMINI_RATE_LIMITED = "RATE_LIMITED";
export const GEMINI_PROVIDER_FAILED = "AI_PROVIDER_FAILED";

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

  // Keep configuration failures opaque to callers. The exact missing secret
  // name must never be returned in an HTTP response or persisted as a reason.
  throw new Error(GEMINI_PROVIDER_FAILED);
}

export function geminiModelUrl(apiKey: string, operation: string): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:${operation}?key=${apiKey}`;
}

/** Convert a provider response into an internal, non-sensitive error code. */
export function geminiResponseError(status: number): Error {
  return new Error(status === 429 ? GEMINI_RATE_LIMITED : GEMINI_PROVIDER_FAILED);
}

export function isGeminiRateLimited(error: unknown): boolean {
  return error instanceof Error && error.message === GEMINI_RATE_LIMITED;
}

/** Safe reason for the server-side credit ledger; never store provider text. */
export function geminiRefundReason(error: unknown): string {
  return isGeminiRateLimited(error) ? "AI provider rate limited" : "AI request failed";
}

/** Safe status text for a failed source record. */
export function publicSourceError(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (message === GEMINI_RATE_LIMITED) return "AI processing is temporarily busy. Please try again.";
  if (message === GEMINI_PROVIDER_FAILED) return "We could not process this source. Please try again.";

  const safeMessages = [
    /^Invalid URL$/,
    /^Only http\(s\) URLs are allowed$/,
    /^URL refers to a private network address$/,
    /^Source not found$/,
    /^Could not read uploaded file$/,
    /^Could not extract meaningful text from source$/,
    /^File too large — max 120 MB$/,
    /^Transcription returned empty — try a shorter clip$/,
    /^URLs with embedded credentials are not allowed$/,
    /^Only standard web ports are allowed$/,
    /^The source URL returned an unsupported content type$/,
    /^The source URL is too large$/,
    /^The source URL did not respond in time$/,
    /^The source URL could not be fetched$/,
    /^Too many redirects$/,
  ];
  return safeMessages.some(pattern => pattern.test(message))
    ? message
    : "We could not process this source. Please try again.";
}
