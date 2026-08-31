-- ============================================================
-- WEEKLY MVP ANNIVERSARY BONUS
-- ------------------------------------------------------------
-- 300 DR for every week someone has ever been crowned Weekly MVP
-- (public.weekly_mvps), not a flat per-person amount — a repeat MVP
-- gets credit for every week they earned it.
--
-- Built as a top-up log from the start (see 20260831c for why a
-- strict one-time claim is the wrong shape): weekly_mvp_claims logs
-- claim events, and new MVP weeks earned after a claim become
-- automatically claimable as a top-up.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.weekly_mvp_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  dr_reward INTEGER NOT NULL,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_weekly_mvp_claims_user ON public.weekly_mvp_claims(user_id);
REVOKE ALL ON public.weekly_mvp_claims FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._weekly_mvp_totals()
RETURNS TABLE (user_id UUID, wins INTEGER, dr_reward INTEGER)
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT wm.user_id, COUNT(*)::INTEGER AS wins, (COUNT(*) * 300)::INTEGER AS dr_reward
  FROM public.weekly_mvps wm
  GROUP BY wm.user_id;
$$;

REVOKE ALL ON FUNCTION public._weekly_mvp_totals() FROM PUBLIC, anon, authenticated;

-- Read-only: safe to call on every app load. dr_reward is the PENDING
-- (unclaimed) amount, not the lifetime total.
CREATE OR REPLACE FUNCTION public.get_weekly_mvp_bonus(p_init_data TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user public.users;
  v_row RECORD;
  v_claimed_dr INTEGER;
  v_pending INTEGER;
BEGIN
  v_user := public.app_user(p_init_data);

  SELECT COALESCE(SUM(dr_reward), 0) INTO v_claimed_dr FROM public.weekly_mvp_claims WHERE user_id = v_user.id;

  SELECT * INTO v_row FROM public._weekly_mvp_totals() t WHERE t.user_id = v_user.id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', true, 'eligible', false, 'claimed', v_claimed_dr > 0, 'dr_reward', 0);
  END IF;

  v_pending := v_row.dr_reward - v_claimed_dr;
  IF v_pending <= 0 THEN
    RETURN jsonb_build_object('success', true, 'eligible', false, 'claimed', true, 'wins', v_row.wins, 'dr_reward', 0);
  END IF;

  RETURN jsonb_build_object(
    'success', true, 'eligible', true, 'claimed', false,
    'wins', v_row.wins, 'dr_reward', v_pending,
    'is_topup', v_claimed_dr > 0
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_weekly_mvp_bonus(TEXT) TO anon, authenticated;

-- Mutating: the "Claim" button. Re-derives the pending amount server-side.
-- Locked per-user for the transaction so two rapid clicks can't both pay out.
CREATE OR REPLACE FUNCTION public.claim_weekly_mvp_bonus(p_init_data TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user public.users;
  v_row RECORD;
  v_claimed_dr INTEGER;
  v_pending INTEGER;
BEGIN
  v_user := public.app_user(p_init_data);
  PERFORM pg_advisory_xact_lock(hashtext('weekly_mvp_claim:' || v_user.id::text));

  SELECT COALESCE(SUM(dr_reward), 0) INTO v_claimed_dr FROM public.weekly_mvp_claims WHERE user_id = v_user.id;

  SELECT * INTO v_row FROM public._weekly_mvp_totals() t WHERE t.user_id = v_user.id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not eligible');
  END IF;

  v_pending := v_row.dr_reward - v_claimed_dr;
  IF v_pending <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Nothing new to claim');
  END IF;

  INSERT INTO public.weekly_mvp_claims (user_id, dr_reward) VALUES (v_user.id, v_pending);

  UPDATE public.users
  SET balance = balance + v_pending, total_earned = total_earned + v_pending
  WHERE id = v_user.id;

  INSERT INTO public.transactions (user_id, type, amount, description)
  VALUES (v_user.id, 'bonus', v_pending, '🏆 Anniversary Weekly MVP Bonus (' || v_row.wins || ' weeks)');

  PERFORM public.record_emission(v_pending);

  RETURN jsonb_build_object('success', true, 'wins', v_row.wins, 'dr_reward', v_pending, 'is_topup', v_claimed_dr > 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_weekly_mvp_bonus(TEXT) TO anon, authenticated;

COMMIT;
