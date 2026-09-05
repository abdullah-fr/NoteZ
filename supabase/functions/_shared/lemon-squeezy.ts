export const LEMON_CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-event-name, x-signature",
};

export const LEMON_PLAN_KEYS = [
  "pro_monthly",
  "pro_yearly",
  "max_monthly",
  "max_yearly",
] as const;

export type LemonPlanKey = (typeof LEMON_PLAN_KEYS)[number];
export type LemonTier = "pro_student" | "pro_scholar";

const PLAN_CONFIG: Record<LemonPlanKey, {
  envName: string;
  tier: LemonTier;
}> = {
  pro_monthly: {
    envName: "LEMON_SQUEEZY_PRO_MONTHLY_VARIANT_ID",
    tier: "pro_student",
  },
  pro_yearly: {
    envName: "LEMON_SQUEEZY_PRO_YEARLY_VARIANT_ID",
    tier: "pro_student",
  },
  max_monthly: {
    envName: "LEMON_SQUEEZY_MAX_MONTHLY_VARIANT_ID",
    tier: "pro_scholar",
  },
  max_yearly: {
    envName: "LEMON_SQUEEZY_MAX_YEARLY_VARIANT_ID",
    tier: "pro_scholar",
  },
};

export function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...LEMON_CORS_HEADERS, "Content-Type": "application/json" },
  });
}

export function isPlanKey(value: unknown): value is LemonPlanKey {
  return typeof value === "string"
    && (LEMON_PLAN_KEYS as readonly string[]).includes(value);
}

export function parsePositiveInteger(value: unknown): number | null {
  const text = typeof value === "number" ? String(value) : String(value ?? "").trim();
  if (!/^[1-9][0-9]*$/.test(text)) return null;
  const numberValue = Number(text);
  return Number.isSafeInteger(numberValue) && numberValue > 0 ? numberValue : null;
}

export function getRequiredEnv(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error("Missing " + name);
  return value;
}

export function getStoreId(): number {
  const value = parsePositiveInteger(Deno.env.get("LEMON_SQUEEZY_STORE_ID"));
  if (!value) throw new Error("Missing or invalid LEMON_SQUEEZY_STORE_ID");
  return value;
}

export function getPlanConfig(plan: LemonPlanKey): {
  variantId: number;
  tier: LemonTier;
} {
  const config = PLAN_CONFIG[plan];
  const variantId = parsePositiveInteger(Deno.env.get(config.envName));
  if (!variantId) throw new Error("Missing or invalid " + config.envName);
  return { variantId, tier: config.tier };
}

export function getTierForVariant(variantId: number): LemonTier | null {
  for (const plan of LEMON_PLAN_KEYS) {
    const config = PLAN_CONFIG[plan];
    const configuredVariant = parsePositiveInteger(Deno.env.get(config.envName));
    if (configuredVariant === variantId) return config.tier;
  }
  return null;
}

export function isTestMode(): boolean {
  return ["1", "true", "yes", "on"].includes(
    (Deno.env.get("LEMON_SQUEEZY_TEST_MODE") ?? "").trim().toLowerCase(),
  );
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string"
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function nullableIntegerText(value: unknown): string | null {
  const parsed = parsePositiveInteger(value);
  return parsed === null ? null : String(parsed);
}

export function nullableText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function parseBoolean(value: unknown): boolean {
  return value === true || value === "true" || value === 1 || value === "1";
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function hmacSha256Hex(
  value: string,
  secret: string,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function constantTimeEqual(left: string, right: string): boolean {
  const a = left.trim().toLowerCase();
  const b = right.trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(a) || !/^[0-9a-f]{64}$/.test(b)) return false;

  let difference = 0;
  for (let index = 0; index < a.length; index += 1) {
    difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return difference === 0;
}

