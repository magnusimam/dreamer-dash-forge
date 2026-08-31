-- ============================================================
-- FIX: Stolen Breath valuation in the community giver bonus
-- ------------------------------------------------------------
-- 20260831_community_giver_bonus.sql valued each Stolen Breath code at
-- ₦1,000, guessed from the DR rate the later Ezer Kenegdo drive used.
-- Wrong — the app's existing Community > Givers leaderboard
-- (useContributionLeaderboard in useSupabase.ts) already established
-- the real value: PROMO_NAIRA_VALUE = 2500. Bringing this function in
-- line with that existing, already-shipped number.
--
-- Safe: community_giver_claims had zero rows when this was written, so
-- no one claimed under the wrong valuation.
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION public._community_giver_totals()
RETURNS TABLE (user_id UUID, naira_given INTEGER, dr_reward INTEGER)
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  WITH stolen_breath AS (
    SELECT pc.claimed_by AS user_id, COUNT(*) * 2500 AS naira
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

COMMIT;
