-- Track previous streak so we can offer restore even after check-in resets it
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS previous_streak INTEGER NOT NULL DEFAULT 0;

-- Update daily checkin to save previous streak before resetting
CREATE OR REPLACE FUNCTION public.perform_daily_checkin(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  v_user RECORD;
  v_already_checked_in BOOLEAN;
  v_new_streak INTEGER;
  v_base_reward INTEGER := 25;
  v_multiplier NUMERIC;
  v_reward INTEGER;
BEGIN
  SELECT * INTO v_user FROM public.users WHERE id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  SELECT EXISTS(SELECT 1 FROM public.daily_checkins WHERE user_id = p_user_id AND check_in_date = CURRENT_DATE) INTO v_already_checked_in;
  IF v_already_checked_in THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already checked in today');
  END IF;

  IF v_user.last_check_in = CURRENT_DATE - INTERVAL '1 day' THEN
    v_new_streak := v_user.streak + 1;
  ELSIF v_user.streak_protected_until IS NOT NULL AND v_user.streak_protected_until >= CURRENT_DATE THEN
    v_new_streak := v_user.streak + 1;
  ELSE
    -- Streak broken — save old streak and timestamp before resetting
    IF v_user.streak > 1 THEN
      UPDATE public.users SET previous_streak = v_user.streak, streak_lost_at = NOW() WHERE id = p_user_id;
    END IF;
    v_new_streak := 1;
  END IF;

  IF v_new_streak % 7 = 0 THEN
    v_base_reward := v_base_reward + 50;
  END IF;

  v_multiplier := public.get_earning_multiplier(v_user.balance);
  v_reward := GREATEST(FLOOR(v_base_reward * v_multiplier)::INTEGER, 0);

  IF v_reward = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet cap reached. Spend some DR to earn more.');
  END IF;

  IF (SELECT treasury_balance FROM public.token_supply WHERE id = 1) < v_reward THEN
    RETURN jsonb_build_object('success', false, 'error', 'Treasury is empty. Try again later.');
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

  RETURN jsonb_build_object('success', true, 'reward', v_reward, 'streak', v_new_streak, 'streak_lost', v_new_streak = 1 AND v_user.streak > 1, 'old_streak', v_user.streak);
END;
$func$;

-- Update restore to use previous_streak and work even after check-in
CREATE OR REPLACE FUNCTION public.restore_streak(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  v_user RECORD;
  v_restore_streak INTEGER;
  v_cost INTEGER;
BEGIN
  SELECT * INTO v_user FROM public.users WHERE id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  -- Use previous_streak if current streak is 1 (just reset)
  IF v_user.streak <= 1 AND v_user.previous_streak > 1 THEN
    v_restore_streak := v_user.previous_streak;
  ELSIF v_user.streak > 1 AND v_user.last_check_in IS NOT NULL AND (CURRENT_DATE - v_user.last_check_in) >= 2 THEN
    v_restore_streak := v_user.streak;
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'No streak to restore');
  END IF;

  IF v_restore_streak >= 90 THEN v_cost := 5000;
  ELSIF v_restore_streak >= 61 THEN v_cost := 2000;
  ELSIF v_restore_streak >= 31 THEN v_cost := 1000;
  ELSIF v_restore_streak >= 15 THEN v_cost := 500;
  ELSIF v_restore_streak >= 8 THEN v_cost := 250;
  ELSE v_cost := 100;
  END IF;

  IF v_user.balance < v_cost THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance. Need ' || v_cost || ' DR to restore your ' || v_restore_streak || '-day streak.');
  END IF;

  UPDATE public.users SET
    balance = balance - v_cost,
    streak = v_restore_streak,
    last_check_in = CURRENT_DATE,
    streak_protected_until = CURRENT_DATE + INTERVAL '1 day',
    previous_streak = 0,
    streak_lost_at = NULL
  WHERE id = p_user_id;

  INSERT INTO public.transactions (user_id, type, amount, description)
  VALUES (p_user_id, 'bonus', -v_cost, 'Streak restore (' || v_restore_streak || '-day streak)');

  PERFORM public.record_recycling(v_cost);

  RETURN jsonb_build_object('success', true, 'cost', v_cost, 'streak', v_restore_streak);
END;
$func$;
