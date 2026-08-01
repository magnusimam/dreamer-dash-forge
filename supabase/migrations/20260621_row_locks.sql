-- ============================================================
-- PHASE 2F — ROW-LOCK HARDENING (anti double-spend / TOCTOU)
-- ------------------------------------------------------------
-- The balance-debit RPCs do SELECT balance ... then UPDATE balance in
-- separate statements with no lock, so N concurrent calls can each read
-- the same pre-spend balance and all pass the check (spend the same DR
-- multiple times). Promo claims can likewise be claimed N times before
-- is_used flips.
--
-- Fix without touching the (renamed) business-logic internals: acquire
-- the relevant row lock in the SECURITY DEFINER wrapper, which runs in
-- the SAME transaction as the internal call. Concurrent operations on
-- the same user (or promo code) now serialize.
-- ============================================================

BEGIN;

-- enter_raffle — locks the caller's balance row
CREATE OR REPLACE FUNCTION public.enter_raffle(p_init_data TEXT, p_raffle_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_uid UUID;
BEGIN
  v_uid := (public.app_user(p_init_data)).id;
  PERFORM 1 FROM public.users WHERE id = v_uid FOR UPDATE;
  RETURN public._enter_raffle(v_uid, p_raffle_id);
END; $$;

-- submit_redemption — locks the caller's balance row
CREATE OR REPLACE FUNCTION public.submit_redemption(p_init_data TEXT, p_category TEXT, p_amount INTEGER, p_details JSONB)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_uid UUID;
BEGIN
  v_uid := (public.app_user(p_init_data)).id;
  PERFORM 1 FROM public.users WHERE id = v_uid FOR UPDATE;
  RETURN public._submit_redemption(v_uid, p_category, p_amount, p_details);
END; $$;

-- buy_streak_insurance — locks the caller's balance row
CREATE OR REPLACE FUNCTION public.buy_streak_insurance(p_init_data TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_uid UUID;
BEGIN
  v_uid := (public.app_user(p_init_data)).id;
  PERFORM 1 FROM public.users WHERE id = v_uid FOR UPDATE;
  RETURN public._buy_streak_insurance(v_uid);
END; $$;

-- register_hackathon — locks the caller's balance row (entry fee debit)
CREATE OR REPLACE FUNCTION public.register_hackathon(p_init_data TEXT, p_hackathon_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_uid UUID;
BEGIN
  v_uid := (public.app_user(p_init_data)).id;
  PERFORM 1 FROM public.users WHERE id = v_uid FOR UPDATE;
  RETURN public._register_hackathon(v_uid, p_hackathon_id);
END; $$;

-- unlock_mission — locks the caller's balance row (unlock fee debit)
CREATE OR REPLACE FUNCTION public.unlock_mission(p_init_data TEXT, p_mission_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_uid UUID;
BEGIN
  v_uid := (public.app_user(p_init_data)).id;
  PERFORM 1 FROM public.users WHERE id = v_uid FOR UPDATE;
  RETURN public._unlock_mission(v_uid, p_mission_id);
END; $$;

-- claim_promo_code — locks the promo row so a code can't be claimed twice
CREATE OR REPLACE FUNCTION public.claim_promo_code(p_init_data TEXT, p_code TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_uid UUID;
BEGIN
  v_uid := (public.app_user(p_init_data)).id;
  PERFORM 1 FROM public.promo_codes WHERE UPPER(code) = UPPER(TRIM(p_code)) FOR UPDATE;
  RETURN public._claim_promo_code(v_uid, p_code);
END; $$;

-- ------------------------------------------------------------
-- Tokenomics emission: serialize the cap check + decrement.
-- can_emit now locks the singleton token_supply row (FOR UPDATE);
-- the lock is held for the rest of the transaction, so the matching
-- record_emission() decrement is atomic w.r.t. the check — concurrent
-- emissions can no longer both pass the daily cap / 21M hard cap.
-- (Body is unchanged except the FOR UPDATE on the initial read.)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_emit(p_amount INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
  v_supply public.token_supply;
  v_cap INTEGER;
BEGIN
  SELECT * INTO v_supply FROM public.token_supply WHERE id = 1 FOR UPDATE;

  -- Reset daily counter if new day
  IF v_supply.today_date < CURRENT_DATE THEN
    UPDATE public.token_supply SET today_distributed = 0, today_date = CURRENT_DATE WHERE id = 1;
    v_supply.today_distributed := 0;
  END IF;

  v_cap := public.get_current_daily_cap();

  -- Check daily cap
  IF v_supply.today_distributed + p_amount > v_cap THEN
    RETURN FALSE;
  END IF;

  -- Check treasury has enough
  IF v_supply.treasury_balance < p_amount THEN
    RETURN FALSE;
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

COMMIT;
