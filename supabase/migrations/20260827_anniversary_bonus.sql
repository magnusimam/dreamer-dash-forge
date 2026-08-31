-- ============================================================
-- ANNIVERSARY 2x BONUS
-- ------------------------------------------------------------
-- Doubles everything a user genuinely earned on a given calendar
-- day (UTC) by crediting a matching "bonus" transaction for the
-- sum of that day's positive, non-transfer earnings. Deliberately
-- ledger-based rather than instrumenting every reward-granting RPC:
-- it is guaranteed to catch every earning path (including any not
-- listed here) without touching existing reward code.
--
-- Excludes `transfer_in` so two colluding users can't mint DR by
-- ping-ponging a transfer back and forth. Only positive amounts are
-- considered, so spends (redeem, transfer_out, hackathon_fee, etc.)
-- are naturally excluded.
--
-- Idempotent and safe to re-run any number of times (e.g. every few
-- hours during the day, or once after): `anniversary_bonus_credits`
-- tracks which source transactions (and the bonus transactions
-- themselves) have already been paid out, so nothing is ever
-- doubled twice.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.anniversary_bonus_credits (
  transaction_id UUID PRIMARY KEY REFERENCES public.transactions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

REVOKE ALL ON public.anniversary_bonus_credits FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._grant_anniversary_bonus(p_date DATE)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_total INTEGER := 0;
  v_users INTEGER := 0;
  v_row RECORD;
  v_new_txn_id UUID;
BEGIN
  FOR v_row IN
    SELECT t.user_id, SUM(t.amount)::INTEGER AS bonus, array_agg(t.id) AS txn_ids
    FROM public.transactions t
    WHERE t.amount > 0
      AND t.type <> 'transfer_in'
      AND t.created_at >= p_date::TIMESTAMPTZ
      AND t.created_at < (p_date + 1)::TIMESTAMPTZ
      AND NOT EXISTS (SELECT 1 FROM public.anniversary_bonus_credits b WHERE b.transaction_id = t.id)
    GROUP BY t.user_id
    HAVING SUM(t.amount) > 0
  LOOP
    -- Mark source transactions as paid BEFORE crediting, so a crash mid-loop
    -- can never result in the same source being bonused twice on retry.
    INSERT INTO public.anniversary_bonus_credits (transaction_id)
    SELECT unnest(v_row.txn_ids)
    ON CONFLICT (transaction_id) DO NOTHING;

    UPDATE public.users
    SET balance = balance + v_row.bonus, total_earned = total_earned + v_row.bonus
    WHERE id = v_row.user_id;

    INSERT INTO public.transactions (user_id, type, amount, description)
    VALUES (v_row.user_id, 'bonus', v_row.bonus, '🎉 Anniversary 2x Bonus')
    RETURNING id INTO v_new_txn_id;

    -- The bonus transaction itself must never be counted as "earned" by a later run.
    INSERT INTO public.anniversary_bonus_credits (transaction_id)
    VALUES (v_new_txn_id)
    ON CONFLICT (transaction_id) DO NOTHING;

    PERFORM public.record_emission(v_row.bonus);
    v_total := v_total + v_row.bonus;
    v_users := v_users + 1;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'users_credited', v_users, 'total_credited', v_total, 'date', p_date);
END;
$$;

REVOKE ALL ON FUNCTION public._grant_anniversary_bonus(DATE) FROM PUBLIC, anon, authenticated;

-- Public wrapper: identity-gateway auth, super-admin only (mass token-mint action).
CREATE OR REPLACE FUNCTION public.grant_anniversary_bonus(p_init_data TEXT, p_date DATE DEFAULT '2026-08-31')
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_admin public.users;
BEGIN
  v_admin := public.app_user(p_init_data);
  IF NOT COALESCE(v_admin.is_super_admin, FALSE) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;
  RETURN public._grant_anniversary_bonus(p_date);
END;
$$;

GRANT EXECUTE ON FUNCTION public.grant_anniversary_bonus(TEXT, DATE) TO anon, authenticated;

COMMIT;
