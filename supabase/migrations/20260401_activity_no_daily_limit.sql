-- Remove daily emission limit from activity claims
-- Activities should always be claimable as long as the user has a valid code

CREATE OR REPLACE FUNCTION public.log_activity(p_user_id UUID, p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  v_activity RECORD;
  v_already_logged BOOLEAN;
  v_user RECORD;
  v_multiplier NUMERIC;
  v_reward INTEGER;
BEGIN
  SELECT * INTO v_activity FROM public.activities WHERE code = p_code AND is_active = TRUE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid activity code');
  END IF;

  SELECT * INTO v_user FROM public.users WHERE id = p_user_id;

  SELECT EXISTS(
    SELECT 1 FROM public.activity_logs WHERE user_id = p_user_id AND activity_id = v_activity.id
  ) INTO v_already_logged;

  IF v_already_logged THEN
    RETURN jsonb_build_object('success', false, 'error', 'Activity already logged');
  END IF;

  IF v_activity.max_participants IS NOT NULL THEN
    IF (SELECT COUNT(*) FROM public.activity_logs WHERE activity_id = v_activity.id) >= v_activity.max_participants THEN
      RETURN jsonb_build_object('success', false, 'error', 'Activity is full');
    END IF;
  END IF;

  v_multiplier := public.get_earning_multiplier(v_user.balance);
  v_reward := GREATEST(FLOOR(v_activity.reward * v_multiplier)::INTEGER, 0);

  IF v_reward = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet cap reached. Spend some DR to earn more.');
  END IF;

  -- Check treasury has enough (but skip daily cap check)
  IF (SELECT treasury_balance FROM public.token_supply WHERE id = 1) < v_reward THEN
    RETURN jsonb_build_object('success', false, 'error', 'Treasury is empty. Try again later.');
  END IF;

  INSERT INTO public.activity_logs (user_id, activity_id) VALUES (p_user_id, v_activity.id);

  UPDATE public.users SET
    balance = balance + v_reward,
    total_earned = total_earned + v_reward
  WHERE id = p_user_id;

  INSERT INTO public.transactions (user_id, type, amount, description, reference_id)
  VALUES (p_user_id, 'earn', v_reward, v_activity.title, v_activity.id);

  PERFORM public.record_emission(v_reward);

  RETURN jsonb_build_object('success', true, 'reward', v_reward, 'activity', v_activity.title);
END;
$func$;
