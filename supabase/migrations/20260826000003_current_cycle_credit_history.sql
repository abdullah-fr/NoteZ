-- Keep historical credit transactions for audit, but expose only the current
-- monthly cycle to the account summary. This prevents legacy per-feature costs
-- from appearing in the new one-request UI after the allowance migration.

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
      AND created_at >= v_credit_rec.period_start
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

REVOKE ALL ON FUNCTION public.get_user_credits_summary(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_credits_summary(UUID) TO authenticated, service_role;
