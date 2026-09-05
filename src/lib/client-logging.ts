/**
 * Browser-safe diagnostics.
 *
 * Never pass an Error, response, request payload, token, or user content to
 * the browser console. Production builds stay silent; development gets only
 * a fixed scope and a generic message.
 */
export function reportClientError(scope: string): void {
  if (import.meta.env.DEV) {
    console.error(`[${scope}] An unexpected error occurred.`);
  }
}

export function reportClientWarning(scope: string): void {
  if (import.meta.env.DEV) {
    console.warn(`[${scope}] A non-fatal browser feature is unavailable.`);
  }
}

/**
 * Only allow messages that are intentionally authored for users. Unknown
 * messages may contain transport, database, or provider details.
 */
export function getSafeClientErrorMessage(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message.trim() : '';
  if (!message) return fallback;

  if (
    message.startsWith('Your monthly AI allowance is exhausted.') ||
    message.startsWith('The AI allowance service is temporarily unavailable.') ||
    message.startsWith('Rate limited.')
  ) {
    return message;
  }

  return fallback;
}

/** Keep persisted source-status text user-safe, including records created by older deployments. */
export function getSafeSourceErrorMessage(error: unknown): string {
  const message = typeof error === 'string'
    ? error.trim()
    : error instanceof Error
      ? error.message.trim()
      : '';
  const safeMessages = [
    /^AI processing is temporarily busy\. Please try again\.$/,
    /^We could not process this source\. Please try again\.$/,
    /^Invalid URL$/,
    /^Only http\(s\) URLs are allowed$/,
    /^URL refers to a private network address$/,
    /^Source not found$/,
    /^Could not read uploaded file$/,
    /^Could not extract meaningful text from source$/,
    /^File too large — max 120 MB$/,
    /^File too large — max 120 MB for audio\/video$/,
    /^Transcription returned empty — try a shorter clip$/,
  ];
  return safeMessages.some(pattern => pattern.test(message))
    ? message
    : 'Could not process this source. Please try again.';
}
