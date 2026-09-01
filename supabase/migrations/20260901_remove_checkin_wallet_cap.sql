-- ============================================================
-- REMOVE WALLET-CAP TAPER FROM DAILY CHECK-IN
-- ------------------------------------------------------------
-- 20260815_full_reward_activities_missions.sql dropped the
-- get_earning_multiplier() taper from activities and missions, but
-- deliberately kept it on check-ins per the user's decision at the time
-- (see reward-taper memory) — check-ins were the one earning path where
-- balance-based tapering was considered acceptable.
--
-- That stopped being acceptable once the 2026-08-31 anniversary bonuses
-- (community awards, weekly MVP, giver bonus) pushed real balances past
-- the 50,000 DR hard cap for the first time — Magnus's balance hit 56,664
-- and his daily check-in started returning "Wallet cap reached." with a
-- zeroed reward. User decision: drop the cap on check-ins too, same as
-- activities/missions, for consistency.
--
-- Body copied verbatim from the live pg_get_functiondef output (not the
-- original 20260325 migration text, which had already drifted), with only
-- the multiplier/cap lines removed — streak logic, streak-protection,
-- and treasury checks are untouched.
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION public._perform_daily_checkin(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_user RECORD;
  v_already_checked_in BOOLEAN;
  v_new_streak INTEGER;
  v_base_reward INTEGER := 25;
  v_reward INTEGER;
BEGIN
  SELECT * INTO v_user FROM public.users WHERE id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.daily_checkins WHERE user_id = p_user_id AND check_in_date = CURRENT_DATE
  ) INTO v_already_checked_in;
  IF v_already_checked_in THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already checked in today');
  END IF;

  IF v_user.last_check_in = CURRENT_DATE - INTERVAL '1 day' THEN
    v_new_streak := v_user.streak + 1;
  ELSIF v_user.streak_protected_until IS NOT NULL AND v_user.streak_protected_until >= CURRENT_DATE THEN
    v_new_streak := v_user.streak + 1;
  ELSE
    IF v_user.streak > 1 THEN
      UPDATE public.users SET previous_streak = v_user.streak, streak_lost_at = NOW() WHERE id = p_user_id;
    END IF;
    v_new_streak := 1;
  END IF;

  IF v_new_streak % 7 = 0 THEN
    v_base_reward := v_base_reward + 50;
  END IF;

  v_reward := v_base_reward;

  IF (SELECT treasury_balance FROM public.token_supply WHERE id = 1) < v_reward THEN
    RETURN jsonb_build_object('success', false, 'error', 'Treasury empty.');
  END IF;

  INSERT INTO public.daily_checkins (user_id, reward) VALUES (p_user_id, v_reward);

  UPDATE public.users SET
    balance = balance + v_reward,
    total_earned = total_earned + v_reward,
    streak = v_new_streak,
    last_check_in = CURRENT_DATE,
    streak_protected_until = NULL
  WHERE id = p_user_id;

  INSERT INTO public.transactions (user_id, type, amount, description)
  VALUES (p_user_id, 'checkin', v_reward, 'Daily check-in (Day ' || v_new_streak || ')');

  PERFORM public.record_emission(v_reward);

  RETURN jsonb_build_object('success', true, 'reward', v_reward, 'streak', v_new_streak);
END;
$function$;

COMMIT;
