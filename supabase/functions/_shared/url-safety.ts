const URL_FETCH_TIMEOUT_MS = 10_000;
const MAX_PUBLIC_RESPONSE_BYTES = 2_000_000;
const MAX_REDIRECTS = 3;

const ALLOWED_TEXT_CONTENT_TYPES = new Set([
  "text/html",
  "text/plain",
  "application/xhtml+xml",
]);

function parseIpv4(hostname: string): number | null {
  const parts = hostname.split(".");
  if (parts.length > 4 || parts.some(part => part.length === 0)) return null;

  const values: number[] = [];
  for (const part of parts) {
    let digits = part;
    let radix = 10;
    if (/^0x[0-9a-f]+$/i.test(part)) {
      digits = part.slice(2);
      radix = 16;
    } else if (/^0[0-7]+$/.test(part) && part.length > 1) {
      digits = part.slice(1);
      radix = 8;
    } else if (!/^\d+$/.test(part)) {
      return null;
    }

    const value = Number.parseInt(digits, radix);
    if (!Number.isSafeInteger(value) || value < 0) return null;
    values.push(value);
  }

  if (values.length === 1 && values[0] <= 0xffffffff) return values[0];
  if (values.length === 2 && values[0] <= 0xff && values[1] <= 0xffffff) {
    return (values[0] << 24) + values[1];
  }
  if (values.length === 3 && values[0] <= 0xff && values[1] <= 0xff && values[2] <= 0xffff) {
    return (values[0] << 24) + (values[1] << 16) + values[2];
  }
  if (values.length === 4 && values.every(value => value <= 0xff)) {
    return (values[0] << 24) + (values[1] << 16) + (values[2] << 8) + values[3];
  }
  return null;
}

function isPrivateIpv4(value: number): boolean {
  const first = (value >>> 24) & 0xff;
  const second = (value >>> 16) & 0xff;
  const third = (value >>> 8) & 0xff;

  return first === 0
    || first === 10
    || first === 127
    || (first === 100 && second >= 64 && second <= 127)
    || (first === 169 && second === 254)
    || (first === 172 && second >= 16 && second <= 31)
    || (first === 192 && second === 168)
    || (first === 192 && second === 0 && third === 0)
    || (first === 198 && (second === 18 || second === 19))
    || first >= 224;
}

function isBlockedHostname(rawHostname: string): boolean {
  const hostname = rawHostname.toLowerCase().replace(/\.$/, "");
  if (!hostname) return true;

  // Reject IPv6 literals entirely. This avoids private, loopback, mapped, and
  // link-local forms without relying on an incomplete hand-rolled IPv6 parser.
  if (hostname.includes(":")) return true;

  if (
    hostname === "localhost"
    || hostname.endsWith(".localhost")
    || hostname.endsWith(".local")
    || hostname.endsWith(".internal")
    || hostname.endsWith(".home.arpa")
    || hostname.endsWith(".lan")
  ) return true;

  const ipv4 = parseIpv4(hostname);
  return ipv4 !== null && isPrivateIpv4(ipv4);
}

export function validatePublicUrl(input: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    throw new Error("Invalid URL");
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("Only http(s) URLs are allowed");
  }
  if (!parsed.hostname || isBlockedHostname(parsed.hostname)) {
    throw new Error("URL refers to a private network address");
  }
  if (parsed.username || parsed.password) {
    throw new Error("URLs with embedded credentials are not allowed");
  }
  if (parsed.port && parsed.port !== "80" && parsed.port !== "443") {
    throw new Error("Only standard web ports are allowed");
  }
  return parsed;
}

async function readTextWithLimit(response: Response): Promise<string> {
  const contentLength = Number(response.headers.get("content-length") || 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_PUBLIC_RESPONSE_BYTES) {
    throw new Error("The source URL is too large");
  }

  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > MAX_PUBLIC_RESPONSE_BYTES) {
        await reader.cancel();
        throw new Error("The source URL is too large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

async function fetchWithTimeout(input: URL, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), URL_FETCH_TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("The source URL did not respond in time");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchPublicText(input: string): Promise<string> {
  let current = validatePublicUrl(input);

  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), URL_FETCH_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(current, {
        redirect: "manual",
        headers: { "User-Agent": "NoteZBot" },
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new Error("The source URL did not respond in time");
      }
      throw error;
    }

    try {
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        if (redirect === MAX_REDIRECTS) throw new Error("Too many redirects");
        const location = response.headers.get("location");
        if (!location) throw new Error("The source URL could not be fetched");
        current = validatePublicUrl(new URL(location, current).toString());
        continue;
      }

      if (!response.ok) throw new Error("The source URL could not be fetched");
      const contentType = (response.headers.get("content-type") || "").split(";", 1)[0].trim().toLowerCase();
      if (contentType && !ALLOWED_TEXT_CONTENT_TYPES.has(contentType)) {
        throw new Error("The source URL returned an unsupported content type");
      }
      return await readTextWithLimit(response);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new Error("The source URL did not respond in time");
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error("Too many redirects");
}

export async function fetchYouTubeOembed(url: URL): Promise<{ title?: string; author_name?: string } | null> {
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const isYouTubeHost = host === "youtube.com" || host === "m.youtube.com" || host === "youtu.be";
  const isVideoUrl = host === "youtu.be"
    ? url.pathname.length > 1
    : url.pathname === "/watch" && Boolean(url.searchParams.get("v"));
  if (!isYouTubeHost || !isVideoUrl) return null;

  const endpoint = new URL("https://www.youtube.com/oembed");
  endpoint.searchParams.set("url", url.toString());
  endpoint.searchParams.set("format", "json");
  const response = await fetchWithTimeout(endpoint, { redirect: "error" });
  if (!response.ok) return null;
  return await response.json() as { title?: string; author_name?: string };
}
