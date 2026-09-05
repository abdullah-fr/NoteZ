import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  getPlanConfig,
  getRequiredEnv,
  getStoreId,
  isPlanKey,
  isTestMode,
  jsonResponse,
} from "../_shared/lemon-squeezy.ts";

type CheckoutResponse = {
  data?: {
    attributes?: {
      url?: unknown;
    };
  };
};

function getAppUrl(): string {
  const appUrl = getRequiredEnv("NOTEZ_APP_URL").replace(/\/+$/, "");
  const parsed = new URL(appUrl);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("NOTEZ_APP_URL must use http or https");
  }
  return appUrl;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    } });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = getRequiredEnv("SUPABASE_URL");
    const anonKey = getRequiredEnv("SUPABASE_ANON_KEY");
    const authorization = req.headers.get("Authorization") ?? "";
    if (!/^Bearer\s+/i.test(authorization)) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    let body: Record<string, unknown>;
    try {
      const parsed = await req.json();
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return jsonResponse({ error: "Invalid checkout request" }, 400);
      }
      body = parsed as Record<string, unknown>;
    } catch {
      return jsonResponse({ error: "Invalid checkout request" }, 400);
    }

    const plan = body.plan;
    if (!isPlanKey(plan)) {
      return jsonResponse({ error: "Unsupported NoteZ plan" }, 400);
    }

    let planConfig: { variantId: number; tier: string };
    let storeId: number;
    try {
      planConfig = getPlanConfig(plan);
      storeId = getStoreId();
    } catch {
      return jsonResponse({ error: "Checkout is not configured yet" }, 503);
    }

    let appUrl: string;
    try {
      appUrl = getAppUrl();
    } catch {
      return jsonResponse({ error: "Checkout is not configured yet" }, 503);
    }

    const user = userData.user;
    const fullName = typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name.trim()
      : "";
    const dashboardUrl = appUrl + "/dashboard";
    const checkoutData: Record<string, unknown> = {
      custom: {
        user_id: user.id,
        plan,
      },
    };
    if (user.email) checkoutData.email = user.email;
    if (fullName) checkoutData.name = fullName;

    const payload = {
      data: {
        type: "checkouts",
        attributes: {
          test_mode: isTestMode(),
          checkout_data: checkoutData,
          product_options: {
            enabled_variants: [planConfig.variantId],
            redirect_url: dashboardUrl,
            receipt_button_text: "Open NoteZ",
            receipt_link_url: dashboardUrl,
            receipt_thank_you_note:
              "Thanks for subscribing to NoteZ. Your study plan will be activated automatically.",
          },
        },
        relationships: {
          store: {
            data: { type: "stores", id: String(storeId) },
          },
          variant: {
            data: { type: "variants", id: String(planConfig.variantId) },
          },
        },
      },
    };

    const response = await fetch("https://api.lemonsqueezy.com/v1/checkouts", {
      method: "POST",
      headers: {
        Accept: "application/vnd.api+json",
        "Content-Type": "application/vnd.api+json",
        Authorization: "Bearer " + getRequiredEnv("LEMON_SQUEEZY_API_KEY"),
      },
      body: JSON.stringify(payload),
    });
    const responseText = await response.text();

    let responseBody: CheckoutResponse | null = null;
    try {
      responseBody = JSON.parse(responseText) as CheckoutResponse;
    } catch {
      responseBody = null;
    }

    if (!response.ok) {
      console.error("Lemon checkout request failed", {
        status: response.status,
        body: responseText.slice(0, 500),
      });
      return jsonResponse({ error: "Unable to start checkout" }, 502);
    }

    const checkoutUrl = responseBody?.data?.attributes?.url;
    if (typeof checkoutUrl !== "string") {
      console.error("Lemon checkout response did not contain a URL");
      return jsonResponse({ error: "Unable to start checkout" }, 502);
    }

    const parsedCheckoutUrl = new URL(checkoutUrl);
    if (parsedCheckoutUrl.protocol !== "https:") {
      console.error("Lemon checkout response contained an unsafe URL");
      return jsonResponse({ error: "Unable to start checkout" }, 502);
    }

    return jsonResponse({ url: parsedCheckoutUrl.toString(), plan });
  } catch (error) {
    console.error("create-lemon-checkout failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return jsonResponse({ error: "Unable to start checkout" }, 500);
  }
});
