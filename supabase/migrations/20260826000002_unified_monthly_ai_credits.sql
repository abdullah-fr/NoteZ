-- Unified monthly AI allowance.
-- Keep the historical tier IDs for database/subscription compatibility; the
-- product displays them as Free, Pro, and Max in the client.

ALTER TABLE public.user_credits
  ALTER COLUMN balance SET DEFAULT 50,
  ALTER COLUMN allowance SET DEFAULT 50,
  ALTER COLUMN period_end SET DEFAULT (now() + INTERVAL '1 month');

-- Start existing accounts on the new monthly allowances. The predicate keeps
-- this migration safe if it is re-applied in a development database.
WITH reset_accounts AS (
  UPDATE public.user_credits
  SET allowance = CASE tier
                    WHEN 'free' THEN 50
                    WHEN 'pro_student' THEN 250
                    WHEN 'pro_scholar' THEN 500
                    ELSE 50000
                  END,
      balance = CASE tier
                  WHEN 'free' THEN 50
                  WHEN 'pro_student' THEN 250
                  WHEN 'pro_scholar' THEN 500
                  ELSE 50000
                END,
      period_start = now(),
      period_end = now() + INTERVAL '1 month',
      updated_at = now()
  WHERE allowance <> CASE tier
                       WHEN 'free' THEN 50
                       WHEN 'pro_student' THEN 250
                       WHEN 'pro_scholar' THEN 500
                       ELSE 50000
                     END
     OR period_end <= now()
  RETURNING user_id, balance
)
INSERT INTO public.credit_transactions
  (user_id, amount, action, description, status, balance_after, metadata)
SELECT user_id, balance, 'credit_refill', 'Monthly AI allowance updated', 'success', balance,
       jsonb_build_object('reason', 'unified_monthly_allowance')
FROM reset_accounts;

CREATE OR REPLACE FUNCTION public.ensure_user_credits(p_user_id UUID)
RETURNS public.user_credits
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rec public.user_credits;
  v_allowance INTEGER;
BEGIN
  INSERT INTO public.user_credits
    (user_id, balance, allowance, tier, period_start, period_end)
  VALUES
    (p_user_id, 50, 50, 'free', now(), now() + INTERVAL '1 month')
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO v_rec
  FROM public.user_credits
  WHERE user_id = p_user_id
  FOR UPDATE;

  v_allowance := CASE v_rec.tier
                   WHEN 'free' THEN 50
                   WHEN 'pro_student' THEN 250
                   WHEN 'pro_scholar' THEN 500
                   ELSE 50000
                 END;

  IF now() >= v_rec.period_end THEN
    UPDATE public.user_credits
    SET balance = v_allowance,
        allowance = v_allowance,
        period_start = now(),
        period_end = now() + INTERVAL '1 month',
        updated_at = now()
    WHERE user_id = p_user_id
    RETURNING * INTO v_rec;

    INSERT INTO public.credit_transactions
      (user_id, amount, action, description, status, balance_after, metadata)
    VALUES
      (p_user_id, v_allowance, 'credit_refill', 'Monthly AI allowance refill', 'success', v_rec.balance,
       jsonb_build_object('tier', v_rec.tier));
  END IF;

  RETURN v_rec;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_and_deduct_credits(
  p_user_id UUID,
  p_amount INTEGER,
  p_action TEXT,
  p_description TEXT DEFAULT '',
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_credit_rec public.user_credits;
  v_new_balance INTEGER;
  v_amount CONSTANT INTEGER := 1;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Credit deductions are server-only';
  END IF;

  v_credit_rec := public.ensure_user_credits(p_user_id);

  IF v_credit_rec.balance < v_amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'MONTHLY_LIMIT_REACHED',
      'balance', v_credit_rec.balance,
      'required', v_amount,
      'reset_date', v_credit_rec.period_end,
      'tier', v_credit_rec.tier
    );
  END IF;

  v_new_balance := v_credit_rec.balance - v_amount;

  UPDATE public.user_credits
  SET balance = v_new_balance, updated_at = now()
  WHERE user_id = p_user_id;

  INSERT INTO public.credit_transactions
    (user_id, amount, action, description, status, balance_after, metadata)
  VALUES
    (p_user_id, -v_amount, p_action, COALESCE(NULLIF(p_description, ''), 'AI request'), 'success', v_new_balance, p_metadata);

  RETURN jsonb_build_object(
    'success', true,
    'balance_after', v_new_balance,
    'deducted', v_amount,
    'reset_date', v_credit_rec.period_end,
    'tier', v_credit_rec.tier
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.refund_credits(
  p_user_id UUID,
  p_amount INTEGER,
  p_action TEXT,
  p_reason TEXT DEFAULT 'Operation failed',
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_balance INTEGER;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Credit refunds are server-only';
  END IF;

  UPDATE public.user_credits
  SET balance = LEAST(balance + 1, allowance), updated_at = now()
  WHERE user_id = p_user_id
  RETURNING balance INTO v_new_balance;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'USER_CREDITS_NOT_FOUND');
  END IF;

  INSERT INTO public.credit_transactions
    (user_id, amount, action, description, status, balance_after, metadata)
  VALUES
    (p_user_id, 1, 'refund', 'Refund: ' || COALESCE(NULLIF(p_reason, ''), 'Operation failed'), 'refunded', v_new_balance, p_metadata);

  RETURN jsonb_build_object('success', true, 'balance_after', v_new_balance);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_user_credits_summary(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_credit_rec public.user_credits;
  v_tx_json JSONB;
  v_used_this_period INTEGER;
BEGIN
  IF auth.role() <> 'service_role' AND auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'You can only view your own credits';
  END IF;

  v_credit_rec := public.ensure_user_credits(p_user_id);

  SELECT COALESCE(ABS(SUM(amount)), 0) INTO v_used_this_period
  FROM public.credit_transactions
  WHERE user_id = p_user_id
    AND amount < 0
    AND status = 'success'
    AND created_at >= v_credit_rec.period_start;

  SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) INTO v_tx_json
  FROM (
    SELECT id, user_id, amount, action, description, status, balance_after, created_at
    FROM public.credit_transactions
    WHERE user_id = p_user_id
    ORDER BY created_at DESC
    LIMIT 50
  ) t;

  RETURN jsonb_build_object(
    'balance', v_credit_rec.balance,
    'allowance', v_credit_rec.allowance,
    'used_this_period', v_used_this_period,
    'tier', v_credit_rec.tier,
    'period_start', v_credit_rec.period_start,
    'period_end', v_credit_rec.period_end,
    'transactions', v_tx_json
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_user_credits(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.check_and_deduct_credits(UUID, INTEGER, TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.refund_credits(UUID, INTEGER, TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_user_credits_summary(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_user_credits(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.check_and_deduct_credits(UUID, INTEGER, TEXT, TEXT, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.refund_credits(UUID, INTEGER, TEXT, TEXT, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_user_credits_summary(UUID) TO authenticated, service_role;
