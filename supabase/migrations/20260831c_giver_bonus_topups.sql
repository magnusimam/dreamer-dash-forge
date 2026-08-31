-- ============================================================
-- GIVER BONUS: SUPPORT TOP-UPS
-- ------------------------------------------------------------
-- The original design let a user claim once, ever — but the amount
-- owed can legitimately change after that: a valuation gets corrected
-- (as just happened with Stolen Breath), or a new support contribution
-- gets approved for someone who already claimed (Ezer Kenegdo is still
-- an active campaign). A strict one-time claim would silently strand
-- that difference forever with no way for the person to ever see it.
--
-- Fix: community_giver_claims becomes a log of claim EVENTS instead of
-- a single locked row per user. Each claim pays out only the delta
-- between the current total owed and what's already been claimed.
-- The popup shows a distinct "new bonus" framing when re-claiming.
--
-- Safe to run: the table had zero rows before this (nobody had claimed
-- under the old design).
-- ============================================================

BEGIN;

ALTER TABLE public.community_giver_claims DROP CONSTRAINT IF EXISTS community_giver_claims_pkey;
ALTER TABLE public.community_giver_claims ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();
UPDATE public.community_giver_claims SET id = gen_random_uuid() WHERE id IS NULL;
ALTER TABLE public.community_giver_claims ALTER COLUMN id SET NOT NULL;
ALTER TABLE public.community_giver_claims ADD CONSTRAINT community_giver_claims_pkey PRIMARY KEY (id);
CREATE INDEX IF NOT EXISTS idx_community_giver_claims_user ON public.community_giver_claims(user_id);

-- Read-only: safe to call on every app load. dr_reward in the response is
-- the PENDING (unclaimed) amount, not the lifetime total.
CREATE OR REPLACE FUNCTION public.get_community_giver_bonus(p_init_data TEXT)
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

  SELECT COALESCE(SUM(dr_reward), 0) INTO v_claimed_dr FROM public.community_giver_claims WHERE user_id = v_user.id;

  SELECT * INTO v_row FROM public._community_giver_totals() t WHERE t.user_id = v_user.id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', true, 'eligible', false, 'claimed', v_claimed_dr > 0, 'dr_reward', 0);
  END IF;

  v_pending := v_row.dr_reward - v_claimed_dr;
  IF v_pending <= 0 THEN
    RETURN jsonb_build_object('success', true, 'eligible', false, 'claimed', true, 'naira_given', v_row.naira_given, 'dr_reward', 0);
  END IF;

  RETURN jsonb_build_object(
    'success', true, 'eligible', true, 'claimed', false,
    'naira_given', v_row.naira_given, 'dr_reward', v_pending,
    'is_topup', v_claimed_dr > 0
  );
END;
$$;

-- Mutating: the "Claim" button. Re-derives the pending amount server-side
-- rather than trusting anything the client saw from get_community_giver_bonus.
-- Locked per-user for the transaction so two rapid clicks can't both pay out.
CREATE OR REPLACE FUNCTION public.claim_community_giver_bonus(p_init_data TEXT)
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
  PERFORM pg_advisory_xact_lock(hashtext('community_giver_claim:' || v_user.id::text));

  SELECT COALESCE(SUM(dr_reward), 0) INTO v_claimed_dr FROM public.community_giver_claims WHERE user_id = v_user.id;

  SELECT * INTO v_row FROM public._community_giver_totals() t WHERE t.user_id = v_user.id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not eligible');
  END IF;

  v_pending := v_row.dr_reward - v_claimed_dr;
  IF v_pending <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Nothing new to claim');
  END IF;

  INSERT INTO public.community_giver_claims (user_id, naira_given, dr_reward)
  VALUES (v_user.id, v_row.naira_given, v_pending);

  UPDATE public.users
  SET balance = balance + v_pending, total_earned = total_earned + v_pending
  WHERE id = v_user.id;

  INSERT INTO public.transactions (user_id, type, amount, description)
  VALUES (v_user.id, 'bonus', v_pending, '💝 Anniversary Giver Bonus (₦' || v_row.naira_given || ' given)');

  PERFORM public.record_emission(v_pending);

  RETURN jsonb_build_object(
    'success', true, 'naira_given', v_row.naira_given, 'dr_reward', v_pending,
    'is_topup', v_claimed_dr > 0
  );
END;
$$;

COMMIT;
