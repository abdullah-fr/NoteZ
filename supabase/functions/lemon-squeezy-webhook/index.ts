import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  constantTimeEqual,
  getRequiredEnv,
  getStoreId,
  getTierForVariant,
  hmacSha256Hex,
  isUuid,
  jsonResponse,
  nullableIntegerText,
  nullableText,
  parseBoolean,
  parsePositiveInteger,
  sha256Hex,
} from "../_shared/lemon-squeezy.ts";

const SUPPORTED_EVENTS = new Set([
  "subscription_created",
  "subscription_updated",
  "subscription_cancelled",
  "subscription_resumed",
  "subscription_expired",
  "subscription_paused",
  "subscription_unpaused",
  "subscription_plan_changed",
]);

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "content-type, x-event-name, x-signature",
    } });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const signingSecret = Deno.env.get("LEMON_SQUEEZY_WEBHOOK_SIGNING_SECRET")?.trim();
  if (!signingSecret) {
    console.error("Missing LEMON_SQUEEZY_WEBHOOK_SIGNING_SECRET");
    return jsonResponse({ error: "Webhook is not configured" }, 500);
  }

  const rawBody = await req.text();
  const signature = req.headers.get("X-Signature") ?? "";
  if (!rawBody || !constantTimeEqual(
    await hmacSha256Hex(rawBody, signingSecret),
    signature,
  )) {
    return jsonResponse({ error: "Invalid signature" }, 401);
  }

  let body: Record<string, unknown>;
  try {
    const parsed = JSON.parse(rawBody);
    const record = asRecord(parsed);
    if (!record) return jsonResponse({ error: "Invalid webhook payload" }, 400);
    body = record;
  } catch {
    return jsonResponse({ error: "Invalid webhook payload" }, 400);
  }

  const meta = asRecord(body.meta);
  const eventName = (
    req.headers.get("X-Event-Name")?.trim()
    || nullableText(meta?.event_name)
    || ""
  );
  if (!SUPPORTED_EVENTS.has(eventName)) {
    return jsonResponse({ ok: true, ignored: true });
  }

  const data = asRecord(body.data);
  if (!data || data.type !== "subscriptions") {
    return jsonResponse({ ok: true, ignored: true });
  }

  const attributes = asRecord(data.attributes);
  if (!attributes) {
    return jsonResponse({ error: "Invalid subscription payload" }, 400);
  }

  const customData = asRecord(meta?.custom_data);
  const userId = customData?.user_id;
  // Share links created directly in Lemon do not carry a NoteZ user ID. They
  // must never be able to grant access to an arbitrary account.
  if (!isUuid(userId)) {
    return jsonResponse({ ok: true, ignored: true });
  }

  const variantId = parsePositiveInteger(attributes.variant_id);
  const productId = nullableIntegerText(attributes.product_id);
  const subscriptionId = nullableIntegerText(data.id);
  const tier = variantId === null ? null : getTierForVariant(variantId);
  if (variantId === null || !productId || !subscriptionId || !tier) {
    return jsonResponse({ ok: true, ignored: true });
  }

  try {
    const expectedStoreId = getStoreId();
    const webhookStoreId = parsePositiveInteger(attributes.store_id);
    if (webhookStoreId !== null && webhookStoreId !== expectedStoreId) {
      return jsonResponse({ error: "Webhook store mismatch" }, 400);
    }
  } catch {
    console.error("Missing or invalid LEMON_SQUEEZY_STORE_ID");
    return jsonResponse({ error: "Webhook is not configured" }, 500);
  }

  const urls = asRecord(attributes.urls);
  const subscription = {
    resource_type: String(data.type),
    lemon_subscription_id: subscriptionId,
    lemon_customer_id: nullableIntegerText(attributes.customer_id),
    lemon_order_id: nullableIntegerText(attributes.order_id),
    product_id: productId,
    variant_id: String(variantId),
    tier,
    status: nullableText(attributes.status) ?? "unknown",
    status_formatted: nullableText(attributes.status_formatted) ?? "",
    user_email: nullableText(attributes.user_email),
    renews_at: nullableText(attributes.renews_at),
    ends_at: nullableText(attributes.ends_at),
    trial_ends_at: nullableText(attributes.trial_ends_at),
    cancelled: parseBoolean(attributes.cancelled),
    update_payment_method_url: nullableText(urls?.update_payment_method),
    raw_data: attributes,
  };

  try {
    const supabaseUrl = getRequiredEnv("SUPABASE_URL");
    const serviceRoleKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: account, error: accountError } = await admin.auth.admin.getUserById(userId);
    if (accountError || !account?.user) {
      return jsonResponse({ ok: true, ignored: true });
    }

    const { data: result, error } = await admin.rpc(
      "apply_lemon_squeezy_subscription_event",
      {
        p_event_hash: await sha256Hex(rawBody),
        p_event_name: eventName,
        p_user_id: userId,
        p_subscription: subscription,
        p_reset_credits: [
          "subscription_created",
          "subscription_resumed",
          "subscription_unpaused",
          "subscription_plan_changed",
        ].includes(eventName),
      },
    );

    if (error) {
      console.error("Lemon subscription event was not applied", {
        eventName,
        status: error.code ?? "unknown",
      });
      return jsonResponse({ error: "Webhook processing failed" }, 500);
    }

    return jsonResponse({ ok: true, result: result ?? null });
  } catch (error) {
    console.error("lemon-squeezy-webhook failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return jsonResponse({ error: "Webhook processing failed" }, 500);
  }
});
