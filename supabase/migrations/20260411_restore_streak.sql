-- Restore a lost streak (only within 48 hours of losing it)
CREATE OR REPLACE FUNCTION public.restore_streak(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  v_user RECORD;
  v_last_streak INTEGER;
  v_days_since_checkin INTEGER;
  v_cost INTEGER;
BEGIN
  SELECT * INTO v_user FROM public.users WHERE id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  IF v_user.last_check_in IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No streak to restore');
  END IF;

  v_days_since_checkin := CURRENT_DATE - v_user.last_check_in;

  -- Must have missed at least 1 day (streak is broken)
  IF v_days_since_checkin <= 1 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Your streak is not broken');
  END IF;

  -- Only available within 48 hours of losing streak (3 calendar days buffer)
  IF v_days_since_checkin > 4 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Too late to restore. Streak can only be restored within 48 hours of losing it.');
  END IF;

  -- The streak they had before losing it
  v_last_streak := v_user.streak;

  IF v_last_streak < 1 THEN
    RETURN jsonb_build_object('success', false, 'error', 'No streak to restore');
  END IF;

  -- Cost based on streak length
  IF v_last_streak >= 90 THEN
    v_cost := 5000;
  ELSIF v_last_streak >= 61 THEN
    v_cost := 2000;
  ELSIF v_last_streak >= 31 THEN
    v_cost := 1000;
  ELSIF v_last_streak >= 15 THEN
    v_cost := 500;
  ELSIF v_last_streak >= 8 THEN
    v_cost := 250;
  ELSE
    v_cost := 100;
  END IF;

  IF v_user.balance < v_cost THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance. Need ' || v_cost || ' DR to restore your ' || v_last_streak || '-day streak.');
  END IF;

  -- Deduct cost
  UPDATE public.users SET
    balance = balance - v_cost,
    last_check_in = CURRENT_DATE - INTERVAL '1 day',
    streak_protected_until = CURRENT_DATE
  WHERE id = p_user_id;

  -- Record transaction
  INSERT INTO public.transactions (user_id, type, amount, description)
  VALUES (p_user_id, 'bonus', -v_cost, 'Streak restore (' || v_last_streak || '-day streak)');

  PERFORM public.record_recycling(v_cost);

  RETURN jsonb_build_object('success', true, 'cost', v_cost, 'streak', v_last_streak);
END;
$func$;
