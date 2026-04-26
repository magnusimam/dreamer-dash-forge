-- Multi-day streak freeze with scaling cost
CREATE OR REPLACE FUNCTION public.freeze_streak(p_user_id UUID, p_days INTEGER)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  v_user RECORD;
  v_cost INTEGER := 0;
  v_i INTEGER;
  v_day_cost INTEGER;
BEGIN
  IF p_days < 1 OR p_days > 30 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Freeze days must be 1-30');
  END IF;

  SELECT * INTO v_user FROM public.users WHERE id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  IF v_user.streak < 2 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Need at least 2-day streak to freeze');
  END IF;

  -- Calculate cost: 50/day for days 1-3, 100/day for 4-7, 200/day for 8-14, 500/day for 15-30
  FOR v_i IN 1..p_days LOOP
    IF v_i <= 3 THEN v_day_cost := 50;
    ELSIF v_i <= 7 THEN v_day_cost := 100;
    ELSIF v_i <= 14 THEN v_day_cost := 150;
    ELSE v_day_cost := 2000;
    END IF;
    v_cost := v_cost + v_day_cost;
  END LOOP;

  IF v_user.balance < v_cost THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance. Need ' || v_cost || ' DR for ' || p_days || ' days freeze.');
  END IF;

  UPDATE public.users SET
    balance = balance - v_cost,
    streak_protected_until = CURRENT_DATE + (p_days * INTERVAL '1 day')
  WHERE id = p_user_id;

  INSERT INTO public.transactions (user_id, type, amount, description)
  VALUES (p_user_id, 'streak_insurance', -v_cost, 'Streak freeze (' || p_days || ' days, ' || v_user.streak || '-day streak)');

  PERFORM public.record_recycling(v_cost);

  RETURN jsonb_build_object('success', true, 'cost', v_cost, 'days', p_days, 'protected_until', (CURRENT_DATE + (p_days * INTERVAL '1 day'))::TEXT, 'streak', v_user.streak);
END;
$func$;
