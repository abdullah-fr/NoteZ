import { supabase } from '@/integrations/supabase/client';
import type { PaidPlan } from '@/lib/billing';

type CheckoutFunctionResponse = {
  url?: unknown;
};

async function getFunctionErrorMessage(error: unknown): Promise<string> {
  const candidate = error as { context?: unknown; message?: unknown } | null;
  if (candidate?.context instanceof Response) {
    try {
      const body = await candidate.context.clone().json() as { error?: unknown };
      if (typeof body.error === 'string' && body.error.trim()) return body.error;
    } catch {
      // Fall through to the generic message.
    }
  }

  return typeof candidate?.message === 'string' && candidate.message.trim()
    ? candidate.message
    : 'Unable to start checkout.';
}

export async function createLemonCheckout(plan: PaidPlan): Promise<string> {
  const { data, error } = await supabase.functions.invoke<CheckoutFunctionResponse>(
    'create-lemon-checkout',
    { body: { plan } },
  );

  if (error) {
    throw new Error(await getFunctionErrorMessage(error));
  }

  if (!data || typeof data.url !== 'string') {
    throw new Error('Unable to start checkout.');
  }

  const checkoutUrl = new URL(data.url);
  if (checkoutUrl.protocol !== 'https:') {
    throw new Error('Unable to start checkout.');
  }

  return checkoutUrl.toString();
}

