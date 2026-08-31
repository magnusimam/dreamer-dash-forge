-- ============================================================
-- ANNIVERSARY TIER BONUS
-- ------------------------------------------------------------
-- Separate from the flat 2x-everything-earned bonus in
-- 20260827_anniversary_bonus.sql: this is a one-off popup-and-claim
-- reward for ACTIVE members only (checked in within the last 7 days
-- of the anniversary date), tiered by the same engagement score used
-- for the member roster:
--   total check-ins + longest streak ever held
--   + 3x(activities attended + missions completed + dream pairs joined)
--
-- Tiers (by percentile rank among active members, by engagement score):
--   Top 20%   -> 3000 DR
--   Next 30%  -> 1500 DR
--   Remaining -> 600 DR
--
-- get_anniversary_tier is read-only (safe to call on every app load to
-- decide whether to show the popup). claim_anniversary_tier_bonus is
-- the mutating action behind the "Claim" button; anniversary_tier_claims
-- makes it idempotent — once claimed, the tier/amount is locked in even
-- if the user's score or the active cohort shifts afterward.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.anniversary_tier_claims (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  tier TEXT NOT NULL CHECK (tier IN ('top20', 'next30', 'active')),
  dr_reward INTEGER NOT NULL,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

REVOKE ALL ON public.anniversary_tier_claims FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._anniversary_active_tiers(p_date DATE)
RETURNS TABLE (user_id UUID, tier TEXT, dr_reward INTEGER, score INTEGER)
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  WITH checkin_streaks AS (
    SELECT
      dc.user_id,
      dc.check_in_date,
      dc.check_in_date - (ROW_NUMBER() OVER (PARTITION BY dc.user_id ORDER BY dc.check_in_date))::int AS grp
    FROM public.daily_checkins dc
  ),
  streak_lengths AS (
    SELECT user_id, grp, COUNT(*) AS streak_len FROM checkin_streaks GROUP BY user_id, grp
  ),
  longest_streaks AS (
    SELECT user_id, MAX(streak_len) AS longest_streak FROM streak_lengths GROUP BY user_id
  ),
  checkin_counts AS (
    SELECT user_id, COUNT(*) AS total_checkins, MAX(check_in_date) AS last_checkin_date
    FROM public.daily_checkins GROUP BY user_id
  ),
  activity_counts AS (
    SELECT user_id, COUNT(*) AS activities_attended FROM public.activity_logs GROUP BY user_id
  ),
  mission_counts AS (
    SELECT user_id, COUNT(*) AS missions_completed FROM public.mission_completions GROUP BY user_id
  ),
  pair_counts AS (
    SELECT user_id, COUNT(*) AS pairs_count FROM (
      SELECT user1_id AS user_id FROM public.dream_pairs WHERE rating_from_2 IS NOT NULL
      UNION ALL
      SELECT user2_id AS user_id FROM public.dream_pairs WHERE rating_from_1 IS NOT NULL
    ) r GROUP BY user_id
  ),
  active_scored AS (
    SELECT
      u.id AS user_id,
      (
        COALESCE(cc.total_checkins, 0)
        + COALESCE(ls.longest_streak, 0)
        + COALESCE(ac.activities_attended, 0) * 3
        + COALESCE(mc.missions_completed, 0) * 3
        + COALESCE(pc.pairs_count, 0) * 3
      )::INTEGER AS score
    FROM public.users u
    JOIN checkin_counts cc ON cc.user_id = u.id
    LEFT JOIN longest_streaks ls ON ls.user_id = u.id
    LEFT JOIN activity_counts ac ON ac.user_id = u.id
    LEFT JOIN mission_counts mc ON mc.user_id = u.id
    LEFT JOIN pair_counts pc ON pc.user_id = u.id
    WHERE cc.last_checkin_date >= (p_date - 6)
      AND cc.last_checkin_date < (p_date + 1)
  ),
  ranked AS (
    SELECT
      user_id,
      score,
      PERCENT_RANK() OVER (ORDER BY score DESC) AS pct_rank
    FROM active_scored
  )
  SELECT
    user_id,
    CASE WHEN pct_rank < 0.20 THEN 'top20' WHEN pct_rank < 0.50 THEN 'next30' ELSE 'active' END AS tier,
    CASE WHEN pct_rank < 0.20 THEN 3000 WHEN pct_rank < 0.50 THEN 1500 ELSE 600 END AS dr_reward,
    score
  FROM ranked;
$$;

REVOKE ALL ON FUNCTION public._anniversary_active_tiers(DATE) FROM PUBLIC, anon, authenticated;

-- Read-only: safe to call on every app load to decide whether to show the popup.
CREATE OR REPLACE FUNCTION public.get_anniversary_tier(p_init_data TEXT, p_date DATE DEFAULT '2026-08-31')
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user public.users;
  v_row RECORD;
  v_claim public.anniversary_tier_claims;
BEGIN
  v_user := public.app_user(p_init_data);

  SELECT * INTO v_claim FROM public.anniversary_tier_claims WHERE user_id = v_user.id;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', true, 'eligible', true, 'claimed', true,
      'tier', v_claim.tier, 'dr_reward', v_claim.dr_reward
    );
  END IF;

  SELECT * INTO v_row FROM public._anniversary_active_tiers(p_date) t WHERE t.user_id = v_user.id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', true, 'eligible', false, 'claimed', false);
  END IF;

  RETURN jsonb_build_object(
    'success', true, 'eligible', true, 'claimed', false,
    'tier', v_row.tier, 'dr_reward', v_row.dr_reward
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_anniversary_tier(TEXT, DATE) TO anon, authenticated;

-- Mutating: the "Claim" button. Re-derives eligibility server-side rather
-- than trusting anything the client saw from get_anniversary_tier.
CREATE OR REPLACE FUNCTION public.claim_anniversary_tier_bonus(p_init_data TEXT, p_date DATE DEFAULT '2026-08-31')
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user public.users;
  v_row RECORD;
  v_inserted public.anniversary_tier_claims;
BEGIN
  v_user := public.app_user(p_init_data);

  IF EXISTS (SELECT 1 FROM public.anniversary_tier_claims WHERE user_id = v_user.id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already claimed');
  END IF;

  SELECT * INTO v_row FROM public._anniversary_active_tiers(p_date) t WHERE t.user_id = v_user.id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not eligible');
  END IF;

  INSERT INTO public.anniversary_tier_claims (user_id, tier, dr_reward)
  VALUES (v_user.id, v_row.tier, v_row.dr_reward)
  ON CONFLICT (user_id) DO NOTHING
  RETURNING * INTO v_inserted;

  IF v_inserted.user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already claimed');
  END IF;

  UPDATE public.users
  SET balance = balance + v_row.dr_reward, total_earned = total_earned + v_row.dr_reward
  WHERE id = v_user.id;

  INSERT INTO public.transactions (user_id, type, amount, description)
  VALUES (
    v_user.id, 'bonus', v_row.dr_reward,
    CASE v_row.tier
      WHEN 'top20' THEN '🎉 Anniversary Bonus — Top 20% Active'
      WHEN 'next30' THEN '🎉 Anniversary Bonus — Top 50% Active'
      ELSE '🎉 Anniversary Bonus — Active Member'
    END
  );

  PERFORM public.record_emission(v_row.dr_reward);

  RETURN jsonb_build_object('success', true, 'tier', v_row.tier, 'dr_reward', v_row.dr_reward);
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_anniversary_tier_bonus(TEXT, DATE) TO anon, authenticated;

COMMIT;
