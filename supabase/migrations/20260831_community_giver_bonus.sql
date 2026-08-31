-- ============================================================
-- COMMUNITY GIVER BONUS
-- ------------------------------------------------------------
-- Anniversary thank-you for everyone who put real money into the
-- community, across every giving channel that exists:
--   - Stolen Breath book-launch codes (promo_codes, valued at ₦1,000
--     each — matching the DR rate used on the later book drive)
--   - ANY approved support_contribution, regardless of campaign —
--     this deliberately does not name "Wisdom Pius" or "Ezer Kenegdo"
--     specifically, so it also captures any future community support
--     drive without a code change.
--
-- Purely proportional, no brackets: 100 DR per ₦1,000 given, uncapped.
-- A flat-tier design was considered and rejected — the gap between the
-- top two givers (₦52,000 vs ₦16,000) was too wide to fairly collapse
-- into one bracket amount.
--
-- Idempotent via community_giver_claims, same pattern as
-- anniversary_tier_claims: once claimed, the amount is locked in even
-- if more contributions get approved for that user afterward.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.community_giver_claims (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  naira_given INTEGER NOT NULL,
  dr_reward INTEGER NOT NULL,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

REVOKE ALL ON public.community_giver_claims FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._community_giver_totals()
RETURNS TABLE (user_id UUID, naira_given INTEGER, dr_reward INTEGER)
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  WITH stolen_breath AS (
    SELECT pc.claimed_by AS user_id, COUNT(*) * 1000 AS naira
    FROM public.promo_codes pc
    WHERE pc.description = 'The Stolen Breath — Book Purchase Reward' AND pc.claimed_by IS NOT NULL
    GROUP BY pc.claimed_by
  ),
  support AS (
    SELECT sc.user_id, SUM(sc.amount) AS naira
    FROM public.support_contributions sc
    WHERE sc.status = 'approved'
    GROUP BY sc.user_id
  ),
  combined AS (
    SELECT user_id, naira FROM stolen_breath
    UNION ALL
    SELECT user_id, naira FROM support
  )
  SELECT
    c.user_id,
    SUM(c.naira)::INTEGER AS naira_given,
    (SUM(c.naira) / 10)::INTEGER AS dr_reward
  FROM combined c
  GROUP BY c.user_id;
$$;

REVOKE ALL ON FUNCTION public._community_giver_totals() FROM PUBLIC, anon, authenticated;

-- Read-only: safe to call on every app load to decide whether to show the popup.
CREATE OR REPLACE FUNCTION public.get_community_giver_bonus(p_init_data TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user public.users;
  v_row RECORD;
  v_claim public.community_giver_claims;
BEGIN
  v_user := public.app_user(p_init_data);

  SELECT * INTO v_claim FROM public.community_giver_claims WHERE user_id = v_user.id;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', true, 'eligible', true, 'claimed', true,
      'naira_given', v_claim.naira_given, 'dr_reward', v_claim.dr_reward
    );
  END IF;

  SELECT * INTO v_row FROM public._community_giver_totals() t WHERE t.user_id = v_user.id;
  IF NOT FOUND OR v_row.dr_reward <= 0 THEN
    RETURN jsonb_build_object('success', true, 'eligible', false, 'claimed', false);
  END IF;

  RETURN jsonb_build_object(
    'success', true, 'eligible', true, 'claimed', false,
    'naira_given', v_row.naira_given, 'dr_reward', v_row.dr_reward
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_community_giver_bonus(TEXT) TO anon, authenticated;

-- Mutating: the "Claim" button. Re-derives the total server-side rather
-- than trusting anything the client saw from get_community_giver_bonus.
CREATE OR REPLACE FUNCTION public.claim_community_giver_bonus(p_init_data TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user public.users;
  v_row RECORD;
  v_inserted public.community_giver_claims;
BEGIN
  v_user := public.app_user(p_init_data);

  IF EXISTS (SELECT 1 FROM public.community_giver_claims WHERE user_id = v_user.id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already claimed');
  END IF;

  SELECT * INTO v_row FROM public._community_giver_totals() t WHERE t.user_id = v_user.id;
  IF NOT FOUND OR v_row.dr_reward <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not eligible');
  END IF;

  INSERT INTO public.community_giver_claims (user_id, naira_given, dr_reward)
  VALUES (v_user.id, v_row.naira_given, v_row.dr_reward)
  ON CONFLICT (user_id) DO NOTHING
  RETURNING * INTO v_inserted;

  IF v_inserted.user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already claimed');
  END IF;

  UPDATE public.users
  SET balance = balance + v_row.dr_reward, total_earned = total_earned + v_row.dr_reward
  WHERE id = v_user.id;

  INSERT INTO public.transactions (user_id, type, amount, description)
  VALUES (v_user.id, 'bonus', v_row.dr_reward, '💝 Anniversary Giver Bonus (₦' || v_row.naira_given || ' given)');

  PERFORM public.record_emission(v_row.dr_reward);

  RETURN jsonb_build_object('success', true, 'naira_given', v_row.naira_given, 'dr_reward', v_row.dr_reward);
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_community_giver_bonus(TEXT) TO anon, authenticated;

COMMIT;
