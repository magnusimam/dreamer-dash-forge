-- ============================================================
-- REMOVE WALLET-CAP TAPER FROM DREAM PAIR CHECK-IN
-- ------------------------------------------------------------
-- 20260901_remove_checkin_wallet_cap.sql dropped the
-- get_earning_multiplier() taper from the normal daily check-in, but the
-- Dream Pair "check in for your partner" path (_checkin_for_pair, the
-- internal function behind checkin_for_pair(p_init_data, p_pair_id))
-- still applied it. Partners at/over 50,000 DR got a zeroed reward and
-- the call failed with "Partner wallet cap reached", so their pair could
-- not check in for them.
--
-- User decision: any pair should always be able to check in for their
-- partner. This removes the multiplier/cap lines only and adds the same
-- treasury check the normal check-in uses. Pair rules (once per pair,
-- partner not already checked in today), streak logic and streak
-- protection are unchanged.
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION public._checkin_for_pair(p_user_id UUID, p_pair_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  v_pair RECORD;
  v_partner_id UUID;
  v_is_user1 BOOLEAN;
  v_already_checked_in BOOLEAN;
  v_new_streak INTEGER;
  v_partner RECORD;
  v_reward INTEGER := 25;
BEGIN
  SELECT * INTO v_pair FROM public.dream_pairs WHERE id = p_pair_id AND status = 'active';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Active pair not found');
  END IF;

  IF v_pair.user1_id = p_user_id THEN
    v_is_user1 := TRUE;
    v_partner_id := v_pair.user2_id;
    IF v_pair.user1_checked_for_2 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Already checked in for your partner this week');
    END IF;
  ELSIF v_pair.user2_id = p_user_id THEN
    v_is_user1 := FALSE;
    v_partner_id := v_pair.user1_id;
    IF v_pair.user2_checked_for_1 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Already checked in for your partner this week');
    END IF;
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Not part of this pair');
  END IF;

  SELECT * INTO v_partner FROM public.users WHERE id = v_partner_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Partner not found');
  END IF;

  -- Check if partner already checked in today
  SELECT EXISTS(SELECT 1 FROM public.daily_checkins WHERE user_id = v_partner_id AND check_in_date = CURRENT_DATE) INTO v_already_checked_in;
  IF v_already_checked_in THEN
    RETURN jsonb_build_object('success', false, 'error', 'Your partner already checked in today');
  END IF;

  -- Calculate streak
  IF v_partner.last_check_in = CURRENT_DATE - INTERVAL '1 day' THEN
    v_new_streak := v_partner.streak + 1;
  ELSIF v_partner.streak_protected_until IS NOT NULL AND v_partner.streak_protected_until >= CURRENT_DATE THEN
    v_new_streak := v_partner.streak + 1;
  ELSE
    v_new_streak := 1;
  END IF;

  IF v_new_streak % 7 = 0 THEN v_reward := v_reward + 50; END IF;

  -- No wallet-cap taper: full reward regardless of partner balance.
  IF (SELECT treasury_balance FROM public.token_supply WHERE id = 1) < v_reward THEN
    RETURN jsonb_build_object('success', false, 'error', 'Treasury empty.');
  END IF;

  INSERT INTO public.daily_checkins (user_id, reward) VALUES (v_partner_id, v_reward);
  UPDATE public.users SET
    balance = balance + v_reward,
    total_earned = total_earned + v_reward,
    streak = v_new_streak,
    last_check_in = CURRENT_DATE,
    streak_protected_until = NULL
  WHERE id = v_partner_id;

  INSERT INTO public.transactions (user_id, type, amount, description)
  VALUES (v_partner_id, 'checkin', v_reward, 'Check-in by Dream Pair partner');

  -- Mark pair
  IF v_is_user1 THEN
    UPDATE public.dream_pairs SET user1_checked_for_2 = TRUE WHERE id = p_pair_id;
  ELSE
    UPDATE public.dream_pairs SET user2_checked_for_1 = TRUE WHERE id = p_pair_id;
  END IF;

  PERFORM public.record_emission(v_reward);

  RETURN jsonb_build_object('success', true, 'reward', v_reward, 'partner_id', v_partner_id, 'partner_name', v_partner.first_name, 'partner_telegram_id', v_partner.telegram_id);
END;
$func$;

-- CREATE OR REPLACE keeps existing grants, but re-assert the lockdown
-- from 20260616_phase2_rpc_auth.sql so the internal function stays private.
REVOKE ALL ON FUNCTION public._checkin_for_pair(UUID, UUID) FROM PUBLIC, anon, authenticated;

COMMIT;
