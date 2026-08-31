-- ============================================================
-- COMMUNITY AWARDS ANNIVERSARY BONUS
-- ------------------------------------------------------------
-- 300 DR per category won in the 1 Year Anniversary & Community
-- Awards vote (13 categories, voted on by the community — see
-- awards_reveal.html for the public reveal page). Winners were
-- matched from the vote sheet to user accounts by Telegram photo
-- hash, since the names on the sheet don't always match what's
-- stored in public.users (display-name drift).
--
-- "Most Active State" (Cross River State, 9 votes) has no single
-- user to credit and is deliberately excluded — it only appears on
-- the public reveal page, not here.
--
-- "Pair of the Year" credits both partners (Careen Eddie and Magnus
-- Imam), since it's a pair award and both were rated as a pair.
--
-- Same top-up pattern as weekly_mvp_bonus (20260831d): a claims log
-- rather than a one-time flag, so re-running this seed with more
-- categories later doesn't require a schema change.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.community_awards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  emoji TEXT NOT NULL,
  votes INTEGER NOT NULL,
  funfact TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_community_awards_user ON public.community_awards(user_id);
REVOKE ALL ON public.community_awards FROM PUBLIC, anon, authenticated;

INSERT INTO public.community_awards (user_id, category, emoji, votes) VALUES
  ('624fc9a1-977a-41d5-a87b-01cc9bc1d1a6', 'Best Streaker', '🔥', 19),
  ('9f499c2d-d82b-4cc8-bd41-50c4a1afb5eb', 'Community Comedian', '😂', 18),
  ('7609c77c-7d89-4e89-8c06-fb18756f4c41', 'Executor of the Year', '🚀', 13),
  ('624fc9a1-977a-41d5-a87b-01cc9bc1d1a6', 'Most Active Dreamer', '🌸', 11),
  ('00069d77-2264-494f-b3c2-edd976e92118', 'Favourite State Ambassador', '🥳', 8),
  ('f171337a-1a3b-4ab2-9d3e-23051c82f2d4', 'Pair of the Year', '🌸', 7),
  ('7609c77c-7d89-4e89-8c06-fb18756f4c41', 'Pair of the Year', '🌸', 7),
  ('87f38c8b-aff7-4ee3-90fd-57a2bbff7386', 'Most Supportive Dreamer', '🌸', 6),
  ('624fc9a1-977a-41d5-a87b-01cc9bc1d1a6', 'Most Consistent Dreamer', '✨', 15),
  ('9f499c2d-d82b-4cc8-bd41-50c4a1afb5eb', 'Coolest of the Year', '🌸', 6),
  ('7268728c-8ae6-4dae-9932-eb01033f340c', 'Creative of the Year', '🌸', 10),
  ('d4bd75fe-9619-4e4a-ab32-233a11a8c872', 'Most Loved Dreamer', '🌸', 6),
  ('624fc9a1-977a-41d5-a87b-01cc9bc1d1a6', 'Dreamer of the Year', '🌟', 11);

CREATE TABLE IF NOT EXISTS public.community_award_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  dr_reward INTEGER NOT NULL,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_community_award_claims_user ON public.community_award_claims(user_id);
REVOKE ALL ON public.community_award_claims FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._community_award_totals()
RETURNS TABLE (user_id UUID, wins INTEGER, dr_reward INTEGER)
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT ca.user_id, COUNT(*)::INTEGER AS wins, (COUNT(*) * 300)::INTEGER AS dr_reward
  FROM public.community_awards ca
  GROUP BY ca.user_id;
$$;

REVOKE ALL ON FUNCTION public._community_award_totals() FROM PUBLIC, anon, authenticated;

-- Read-only: safe to call on every app load. dr_reward is the PENDING
-- (unclaimed) amount, not the lifetime total. Includes the list of won
-- categories so the popup can show each award, not just a count.
CREATE OR REPLACE FUNCTION public.get_community_award_bonus(p_init_data TEXT)
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
  v_awards JSONB;
BEGIN
  v_user := public.app_user(p_init_data);

  SELECT COALESCE(SUM(dr_reward), 0) INTO v_claimed_dr FROM public.community_award_claims WHERE user_id = v_user.id;

  SELECT * INTO v_row FROM public._community_award_totals() t WHERE t.user_id = v_user.id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', true, 'eligible', false, 'claimed', v_claimed_dr > 0, 'dr_reward', 0);
  END IF;

  v_pending := v_row.dr_reward - v_claimed_dr;
  IF v_pending <= 0 THEN
    RETURN jsonb_build_object('success', true, 'eligible', false, 'claimed', true, 'wins', v_row.wins, 'dr_reward', 0);
  END IF;

  SELECT jsonb_agg(jsonb_build_object('category', category, 'emoji', emoji, 'votes', votes) ORDER BY votes DESC)
  INTO v_awards
  FROM public.community_awards WHERE user_id = v_user.id;

  RETURN jsonb_build_object(
    'success', true, 'eligible', true, 'claimed', false,
    'wins', v_row.wins, 'dr_reward', v_pending,
    'is_topup', v_claimed_dr > 0,
    'awards', v_awards
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_community_award_bonus(TEXT) TO anon, authenticated;

-- Mutating: the "Claim" button. Re-derives the pending amount server-side.
-- Locked per-user for the transaction so two rapid clicks can't both pay out.
CREATE OR REPLACE FUNCTION public.claim_community_award_bonus(p_init_data TEXT)
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
  PERFORM pg_advisory_xact_lock(hashtext('community_award_claim:' || v_user.id::text));

  SELECT COALESCE(SUM(dr_reward), 0) INTO v_claimed_dr FROM public.community_award_claims WHERE user_id = v_user.id;

  SELECT * INTO v_row FROM public._community_award_totals() t WHERE t.user_id = v_user.id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not eligible');
  END IF;

  v_pending := v_row.dr_reward - v_claimed_dr;
  IF v_pending <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Nothing new to claim');
  END IF;

  INSERT INTO public.community_award_claims (user_id, dr_reward) VALUES (v_user.id, v_pending);

  UPDATE public.users
  SET balance = balance + v_pending, total_earned = total_earned + v_pending
  WHERE id = v_user.id;

  INSERT INTO public.transactions (user_id, type, amount, description)
  VALUES (v_user.id, 'bonus', v_pending, '🏆 Anniversary Community Award Bonus (' || v_row.wins || ' ' || CASE WHEN v_row.wins = 1 THEN 'award' ELSE 'awards' END || ')');

  PERFORM public.record_emission(v_pending);

  RETURN jsonb_build_object('success', true, 'wins', v_row.wins, 'dr_reward', v_pending, 'is_topup', v_claimed_dr > 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_community_award_bonus(TEXT) TO anon, authenticated;

COMMIT;
