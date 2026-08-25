-- ─────────────────────────────────────────────────────────────────────────────
-- Centralized Credits & Subscription System for NoteZ
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Create user_credits table to store user credit balances and billing periods
CREATE TABLE IF NOT EXISTS public.user_credits (
  user_id             UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance             INTEGER NOT NULL DEFAULT 500 CHECK (balance >= 0),
  monthly_allowance   INTEGER NOT NULL DEFAULT 500 CHECK (monthly_allowance >= 0),
  tier                TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'pro_student', 'pro_scholar', 'team')),
  period_start        TIMESTAMPTZ NOT NULL DEFAULT now(),
  period_end          TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '30 days'),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Create credit_transactions ledger table for auditability and history
CREATE TABLE IF NOT EXISTS public.credit_transactions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount              INTEGER NOT NULL, -- Negative for deduction, positive for refill/grant
  action              TEXT NOT NULL,    -- e.g. 'ai_chat', 'generate_exam', 'monthly_grant', 'refund'
  description         TEXT,
  status              TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'refunded', 'failed')),
  balance_after       INTEGER NOT NULL,
  metadata            JSONB DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Enable Row Level Security
ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies (Users can view their own data, write is via secure RPCs / service role)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_credits' AND policyname = 'Users can view own credits'
  ) THEN
    CREATE POLICY "Users can view own credits" ON public.user_credits
      FOR SELECT USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'credit_transactions' AND policyname = 'Users can view own credit transactions'
  ) THEN
    CREATE POLICY "Users can view own credit transactions" ON public.credit_transactions
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

-- 5. Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_user_credits_user_id ON public.user_credits(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_created ON public.credit_transactions(user_id, created_at DESC);

-- 6. Helper: Ensure user credit record exists (defaults to 500 for Free tier)
CREATE OR REPLACE FUNCTION public.ensure_user_credits(p_user_id UUID)
RETURNS public.user_credits
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rec public.user_credits;
BEGIN
  SELECT * INTO v_rec FROM public.user_credits WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    INSERT INTO public.user_credits (user_id, balance, monthly_allowance, tier, period_start, period_end)
    VALUES (p_user_id, 500, 500, 'free', now(), now() + INTERVAL '30 days')
    ON CONFLICT (user_id) DO UPDATE SET updated_at = now()
    RETURNING * INTO v_rec;

    -- Record initial grant transaction
    INSERT INTO public.credit_transactions (user_id, amount, action, description, status, balance_after)
    VALUES (p_user_id, 500, 'initial_grant', 'Welcome to NoteZ (Free Tier Allowance)', 'success', 500);
  END IF;

  -- Check if monthly reset period has elapsed
  IF now() >= v_rec.period_end THEN
    UPDATE public.user_credits
    SET balance = v_rec.monthly_allowance,
        period_start = now(),
        period_end = now() + INTERVAL '30 days',
        updated_at = now()
    WHERE user_id = p_user_id
    RETURNING * INTO v_rec;

    INSERT INTO public.credit_transactions (user_id, amount, action, description, status, balance_after)
    VALUES (p_user_id, v_rec.monthly_allowance, 'monthly_grant', 'Monthly credit allowance reset', 'success', v_rec.balance);
  END IF;

  RETURN v_rec;
END;
$$;

-- 7. Atomic RPC: Check and Deduct Credits
CREATE OR REPLACE FUNCTION public.check_and_deduct_credits(
  p_user_id     UUID,
  p_amount      INTEGER,
  p_action      TEXT,
  p_description TEXT DEFAULT '',
  p_metadata    JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_credit_rec public.user_credits;
  v_new_balance INTEGER;
BEGIN
  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('success', true, 'balance_after', 0, 'deducted', 0);
  END IF;

  -- Ensure record exists and reset period is up to date
  v_credit_rec := public.ensure_user_credits(p_user_id);

  IF v_credit_rec.balance < p_amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'INSUFFICIENT_CREDITS',
      'balance', v_credit_rec.balance,
      'required', p_amount,
      'reset_date', v_credit_rec.period_end,
      'tier', v_credit_rec.tier
    );
  END IF;

  -- Deduct credits atomically
  v_new_balance := v_credit_rec.balance - p_amount;

  UPDATE public.user_credits
  SET balance = v_new_balance, updated_at = now()
  WHERE user_id = p_user_id;

  -- Record in ledger
  INSERT INTO public.credit_transactions (
    user_id, amount, action, description, status, balance_after, metadata
  ) VALUES (
    p_user_id, -p_amount, p_action, p_description, 'success', v_new_balance, p_metadata
  );

  RETURN jsonb_build_object(
    'success', true,
    'balance_after', v_new_balance,
    'deducted', p_amount,
    'reset_date', v_credit_rec.period_end
  );
END;
$$;

-- 8. Atomic RPC: Refund Credits (e.g. when an API request fails)
CREATE OR REPLACE FUNCTION public.refund_credits(
  p_user_id     UUID,
  p_amount      INTEGER,
  p_action      TEXT,
  p_reason      TEXT DEFAULT 'Operation failed',
  p_metadata    JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_credit_rec public.user_credits;
  v_new_balance INTEGER;
BEGIN
  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('success', true, 'refunded', 0);
  END IF;

  v_credit_rec := public.ensure_user_credits(p_user_id);
  v_new_balance := v_credit_rec.balance + p_amount;

  UPDATE public.user_credits
  SET balance = v_new_balance, updated_at = now()
  WHERE user_id = p_user_id;

  INSERT INTO public.credit_transactions (
    user_id, amount, action, description, status, balance_after, metadata
  ) VALUES (
    p_user_id, p_amount, 'refund', p_reason, 'refunded', v_new_balance, p_metadata
  );

  RETURN jsonb_build_object(
    'success', true,
    'balance_after', v_new_balance,
    'refunded', p_amount
  );
END;
$$;

-- 9. RPC: Get User Credits Summary
CREATE OR REPLACE FUNCTION public.get_user_credits_summary(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_credit_rec public.user_credits;
  v_transactions JSONB;
  v_used_this_period INTEGER;
BEGIN
  v_credit_rec := public.ensure_user_credits(p_user_id);

  -- Fetch recent 10 transactions
  SELECT jsonb_agg(to_jsonb(t)) INTO v_transactions
  FROM (
    SELECT id, amount, action, description, status, balance_after, created_at
    FROM public.credit_transactions
    WHERE user_id = p_user_id
    ORDER BY created_at DESC
    LIMIT 15
  ) t;

  -- Calculate used this period
  SELECT COALESCE(ABS(SUM(amount)), 0) INTO v_used_this_period
  FROM public.credit_transactions
  WHERE user_id = p_user_id
    AND amount < 0
    AND status = 'success'
    AND created_at >= v_credit_rec.period_start;

  RETURN jsonb_build_object(
    'balance', v_credit_rec.balance,
    'monthly_allowance', v_credit_rec.monthly_allowance,
    'used_this_period', v_used_this_period,
    'tier', v_credit_rec.tier,
    'period_start', v_credit_rec.period_start,
    'period_end', v_credit_rec.period_end,
    'transactions', COALESCE(v_transactions, '[]'::jsonb)
  );
END;
$$;

-- Grant execution to authenticated users
GRANT EXECUTE ON FUNCTION public.ensure_user_credits(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_and_deduct_credits(UUID, INTEGER, TEXT, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refund_credits(UUID, INTEGER, TEXT, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_credits_summary(UUID) TO authenticated;
