-- Lemon Squeezy subscriptions and webhook idempotency.
--
-- Lemon is the payment system of record. The signed webhook is the only
-- path that can change a NoteZ user's paid tier.

CREATE TABLE IF NOT EXISTS public.lemon_squeezy_subscriptions (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lemon_subscription_id       BIGINT NOT NULL UNIQUE,
  lemon_customer_id           BIGINT,
  lemon_order_id              BIGINT,
  product_id                  BIGINT NOT NULL,
  variant_id                  BIGINT NOT NULL,
  tier                        TEXT NOT NULL CHECK (tier IN ('pro_student', 'pro_scholar')),
  status                      TEXT NOT NULL,
  status_formatted            TEXT NOT NULL DEFAULT '',
  user_email                  TEXT,
  renews_at                   TIMESTAMPTZ,
  ends_at                     TIMESTAMPTZ,
  trial_ends_at               TIMESTAMPTZ,
  cancelled                   BOOLEAN NOT NULL DEFAULT false,
  update_payment_method_url   TEXT,
  raw_data                    JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lemon_subscriptions_user
  ON public.lemon_squeezy_subscriptions(user_id);

CREATE TABLE IF NOT EXISTS public.lemon_squeezy_webhook_events (
  event_hash       TEXT PRIMARY KEY CHECK (char_length(event_hash) = 64),
  event_name       TEXT NOT NULL,
  resource_type    TEXT,
  resource_id      BIGINT,
  payload          JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.lemon_squeezy_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lemon_squeezy_webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own Lemon subscriptions"
  ON public.lemon_squeezy_subscriptions;
CREATE POLICY "Users can view own Lemon subscriptions"
  ON public.lemon_squeezy_subscriptions
  FOR SELECT
  USING (auth.uid() = user_id);

REVOKE ALL ON TABLE public.lemon_squeezy_subscriptions FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.lemon_squeezy_subscriptions TO authenticated, service_role;

REVOKE ALL ON TABLE public.lemon_squeezy_webhook_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.lemon_squeezy_webhook_events TO service_role;

-- Apply one verified Lemon subscription event atomically and exactly once.
CREATE OR REPLACE FUNCTION public.apply_lemon_squeezy_subscription_event(
  p_event_hash      TEXT,
  p_event_name      TEXT,
  p_user_id         UUID,
  p_subscription    JSONB,
  p_reset_credits   BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_user_id UUID;
  v_subscription_id BIGINT;
  v_customer_id BIGINT;
  v_order_id BIGINT;
  v_product_id BIGINT;
  v_variant_id BIGINT;
  v_new_tier TEXT;
  v_allowance INTEGER;
  v_current public.user_credits;
  v_should_reset BOOLEAN;
  v_event_rows INTEGER;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Lemon subscription updates are server-only';
  END IF;

  IF p_event_hash IS NULL OR p_event_hash !~ '^[0-9a-fA-F]{64}$' THEN
    RAISE EXCEPTION 'Invalid Lemon webhook event hash';
  END IF;

  IF p_user_id IS NULL OR jsonb_typeof(p_subscription) <> 'object' THEN
    RAISE EXCEPTION 'Invalid Lemon subscription payload';
  END IF;

  IF COALESCE(p_subscription->>'lemon_subscription_id', '') !~ '^[1-9][0-9]*$'
     OR COALESCE(p_subscription->>'product_id', '') !~ '^[1-9][0-9]*$'
     OR COALESCE(p_subscription->>'variant_id', '') !~ '^[1-9][0-9]*$' THEN
    RAISE EXCEPTION 'Invalid Lemon subscription identifiers';
  END IF;

  v_subscription_id := (p_subscription->>'lemon_subscription_id')::BIGINT;
  v_product_id := (p_subscription->>'product_id')::BIGINT;
  v_variant_id := (p_subscription->>'variant_id')::BIGINT;
  v_new_tier := p_subscription->>'tier';

  IF v_new_tier NOT IN ('pro_student', 'pro_scholar') THEN
    RAISE EXCEPTION 'Unsupported NoteZ billing tier';
  END IF;

  IF NULLIF(p_subscription->>'lemon_customer_id', '') IS NOT NULL THEN
    v_customer_id := (p_subscription->>'lemon_customer_id')::BIGINT;
  END IF;

  IF NULLIF(p_subscription->>'lemon_order_id', '') IS NOT NULL THEN
    v_order_id := (p_subscription->>'lemon_order_id')::BIGINT;
  END IF;

  INSERT INTO public.lemon_squeezy_webhook_events
    (event_hash, event_name, resource_type, resource_id, payload)
  VALUES
    (
      lower(p_event_hash),
      p_event_name,
      p_subscription->>'resource_type',
      v_subscription_id,
      COALESCE(p_subscription->'raw_data', '{}'::jsonb)
    )
  ON CONFLICT (event_hash) DO NOTHING;

  GET DIAGNOSTICS v_event_rows = ROW_COUNT;
  IF v_event_rows = 0 THEN
    RETURN jsonb_build_object('ok', true, 'duplicate', true);
  END IF;

  SELECT user_id
    INTO v_existing_user_id
  FROM public.lemon_squeezy_subscriptions
  WHERE lemon_subscription_id = v_subscription_id
  FOR UPDATE;

  IF v_existing_user_id IS NOT NULL AND v_existing_user_id IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Lemon subscription is linked to another NoteZ account';
  END IF;

  INSERT INTO public.lemon_squeezy_subscriptions (
    user_id,
    lemon_subscription_id,
    lemon_customer_id,
    lemon_order_id,
    product_id,
    variant_id,
    tier,
    status,
    status_formatted,
    user_email,
    renews_at,
    ends_at,
    trial_ends_at,
    cancelled,
    update_payment_method_url,
    raw_data
  )
  VALUES (
    p_user_id,
    v_subscription_id,
    v_customer_id,
    v_order_id,
    v_product_id,
    v_variant_id,
    v_new_tier,
    COALESCE(NULLIF(p_subscription->>'status', ''), 'unknown'),
    COALESCE(p_subscription->>'status_formatted', ''),
    NULLIF(p_subscription->>'user_email', ''),
    NULLIF(p_subscription->>'renews_at', '')::TIMESTAMPTZ,
    NULLIF(p_subscription->>'ends_at', '')::TIMESTAMPTZ,
    NULLIF(p_subscription->>'trial_ends_at', '')::TIMESTAMPTZ,
    COALESCE((p_subscription->>'cancelled')::BOOLEAN, false),
    NULLIF(p_subscription->>'update_payment_method_url', ''),
    COALESCE(p_subscription->'raw_data', '{}'::jsonb)
  )
  ON CONFLICT (lemon_subscription_id) DO UPDATE SET
    lemon_customer_id = EXCLUDED.lemon_customer_id,
    lemon_order_id = EXCLUDED.lemon_order_id,
    product_id = EXCLUDED.product_id,
    variant_id = EXCLUDED.variant_id,
    tier = EXCLUDED.tier,
    status = EXCLUDED.status,
    status_formatted = EXCLUDED.status_formatted,
    user_email = EXCLUDED.user_email,
    renews_at = EXCLUDED.renews_at,
    ends_at = EXCLUDED.ends_at,
    trial_ends_at = EXCLUDED.trial_ends_at,
    cancelled = EXCLUDED.cancelled,
    update_payment_method_url = EXCLUDED.update_payment_method_url,
    raw_data = EXCLUDED.raw_data,
    updated_at = now();

  -- This also creates the row for a customer who reaches checkout before
  -- opening the dashboard for the first time.
  PERFORM public.ensure_user_credits(p_user_id);
  SELECT *
    INTO v_current
  FROM public.user_credits
  WHERE user_id = p_user_id
  FOR UPDATE;

  -- Keep access through a cancellation grace period, but remove it after
  -- ends_at or when Lemon reports an expired/paused subscription.
  SELECT s.tier
    INTO v_new_tier
  FROM public.lemon_squeezy_subscriptions AS s
  WHERE s.user_id = p_user_id
    AND s.status IN ('active', 'on_trial', 'past_due', 'cancelled')
    AND (s.ends_at IS NULL OR s.ends_at > now())
    AND (
      NOT s.cancelled
      OR (s.ends_at IS NOT NULL AND s.ends_at > now())
    )
    AND (s.raw_data->>'pause' IS NULL OR s.raw_data->>'pause' = '')
  ORDER BY
    CASE s.tier
      WHEN 'pro_scholar' THEN 2
      WHEN 'pro_student' THEN 1
      ELSE 0
    END DESC,
    COALESCE(s.renews_at, s.ends_at) DESC NULLS LAST
  LIMIT 1;

  v_new_tier := COALESCE(v_new_tier, 'free');
  v_allowance := CASE v_new_tier
    WHEN 'pro_student' THEN 250
    WHEN 'pro_scholar' THEN 500
    ELSE 50
  END;
  v_should_reset := v_current.tier IS DISTINCT FROM v_new_tier OR p_reset_credits;

  IF v_should_reset THEN
    UPDATE public.user_credits
    SET tier = v_new_tier,
        balance = v_allowance,
        allowance = v_allowance,
        period_start = now(),
        period_end = now() + INTERVAL '1 month',
        updated_at = now()
    WHERE user_id = p_user_id;

    INSERT INTO public.credit_transactions
      (user_id, amount, action, description, status, balance_after, metadata)
    VALUES
      (
        p_user_id,
        v_allowance,
        CASE WHEN v_new_tier = 'free' THEN 'subscription_ended' ELSE 'subscription_activated' END,
        CASE
          WHEN v_new_tier = 'free' THEN 'Lemon Squeezy subscription access ended'
          ELSE 'Lemon Squeezy subscription activated'
        END,
        'success',
        v_allowance,
        jsonb_build_object(
          'provider', 'lemon_squeezy',
          'event_name', p_event_name,
          'tier', v_new_tier,
          'variant_id', v_variant_id
        )
      );
  ELSE
    UPDATE public.user_credits
    SET tier = v_new_tier,
        allowance = v_allowance,
        updated_at = now()
    WHERE user_id = p_user_id;
  END IF;

  UPDATE public.lemon_squeezy_webhook_events
  SET processed_at = now()
  WHERE event_hash = lower(p_event_hash);

  RETURN jsonb_build_object(
    'ok', true,
    'duplicate', false,
    'tier', v_new_tier,
    'credits_reset', v_should_reset
  );
END;
$$;

REVOKE ALL ON FUNCTION public.apply_lemon_squeezy_subscription_event(TEXT, TEXT, UUID, JSONB, BOOLEAN)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_lemon_squeezy_subscription_event(TEXT, TEXT, UUID, JSONB, BOOLEAN)
  TO service_role;
