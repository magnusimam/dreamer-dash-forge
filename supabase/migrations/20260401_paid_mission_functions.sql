-- Unlock a mission (pay DR)
CREATE OR REPLACE FUNCTION public.unlock_mission(p_user_id UUID, p_mission_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  v_mission RECORD;
  v_user RECORD;
  v_already_unlocked BOOLEAN;
BEGIN
  SELECT * INTO v_mission FROM public.missions WHERE id = p_mission_id AND is_active = TRUE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Mission not found');
  END IF;

  IF v_mission.expires_at IS NOT NULL AND v_mission.expires_at < NOW() THEN
    RETURN jsonb_build_object('success', false, 'error', 'This mission has expired');
  END IF;

  SELECT * INTO v_user FROM public.users WHERE id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  SELECT EXISTS(SELECT 1 FROM public.mission_unlocks WHERE user_id = p_user_id AND mission_id = p_mission_id) INTO v_already_unlocked;
  IF v_already_unlocked THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already unlocked');
  END IF;

  IF v_mission.unlock_fee > 0 THEN
    IF v_user.balance < v_mission.unlock_fee THEN
      RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance. Need ' || v_mission.unlock_fee || ' DR');
    END IF;

    UPDATE public.users SET balance = balance - v_mission.unlock_fee WHERE id = p_user_id;

    INSERT INTO public.transactions (user_id, type, amount, description, reference_id)
    VALUES (p_user_id, 'mission', -v_mission.unlock_fee, 'Mission unlock: ' || v_mission.title, v_mission.id);

    PERFORM public.record_recycling(v_mission.unlock_fee);
  END IF;

  INSERT INTO public.mission_unlocks (user_id, mission_id) VALUES (p_user_id, p_mission_id);

  RETURN jsonb_build_object('success', true, 'mission', v_mission.title, 'fee', v_mission.unlock_fee, 'description', v_mission.description, 'completion_code', v_mission.completion_code);
END;
$func$;

-- Complete a mission (enter code after unlocking)
CREATE OR REPLACE FUNCTION public.complete_mission(p_user_id UUID, p_mission_id UUID, p_code TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  v_mission RECORD;
  v_user RECORD;
  v_already_completed BOOLEAN;
  v_is_unlocked BOOLEAN;
  v_multiplier NUMERIC;
  v_reward INTEGER;
BEGIN
  SELECT * INTO v_mission FROM public.missions WHERE id = p_mission_id AND is_active = TRUE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Mission not found');
  END IF;

  IF v_mission.expires_at IS NOT NULL AND v_mission.expires_at < NOW() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Mission has expired');
  END IF;

  SELECT * INTO v_user FROM public.users WHERE id = p_user_id;

  -- Check if mission requires unlock
  IF v_mission.unlock_fee > 0 THEN
    SELECT EXISTS(SELECT 1 FROM public.mission_unlocks WHERE user_id = p_user_id AND mission_id = p_mission_id) INTO v_is_unlocked;
    IF NOT v_is_unlocked THEN
      RETURN jsonb_build_object('success', false, 'error', 'Mission not unlocked. Pay ' || v_mission.unlock_fee || ' DR to unlock first.');
    END IF;
  END IF;

  -- Check completion code if mission has one
  IF v_mission.completion_code IS NOT NULL AND v_mission.completion_code != '' THEN
    IF p_code IS NULL OR UPPER(TRIM(p_code)) != UPPER(TRIM(v_mission.completion_code)) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid completion code');
    END IF;
  END IF;

  SELECT EXISTS(SELECT 1 FROM public.mission_completions WHERE user_id = p_user_id AND mission_id = p_mission_id) INTO v_already_completed;
  IF v_already_completed THEN
    RETURN jsonb_build_object('success', false, 'error', 'Mission already completed');
  END IF;

  v_multiplier := public.get_earning_multiplier(v_user.balance);
  v_reward := GREATEST(FLOOR(v_mission.reward * v_multiplier)::INTEGER, 0);

  IF v_reward = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet cap reached.');
  END IF;

  IF (SELECT treasury_balance FROM public.token_supply WHERE id = 1) < v_reward THEN
    RETURN jsonb_build_object('success', false, 'error', 'Treasury is empty. Try again later.');
  END IF;

  INSERT INTO public.mission_completions (user_id, mission_id, completed_at)
  VALUES (p_user_id, p_mission_id, NOW());

  UPDATE public.users SET balance = balance + v_reward, total_earned = total_earned + v_reward WHERE id = p_user_id;

  INSERT INTO public.transactions (user_id, type, amount, description, reference_id)
  VALUES (p_user_id, 'mission', v_reward, 'Mission complete: ' || v_mission.title, v_mission.id);

  PERFORM public.record_emission(v_reward);

  RETURN jsonb_build_object('success', true, 'reward', v_reward, 'mission', v_mission.title);
END;
$func$;
