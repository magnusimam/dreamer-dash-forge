-- Update complete_mission to accept a note (e.g. who they gifted)
-- Drop old versions first
DROP FUNCTION IF EXISTS public.complete_mission(UUID, UUID);
DROP FUNCTION IF EXISTS public.complete_mission(UUID, UUID, TEXT);

CREATE OR REPLACE FUNCTION public.complete_mission(p_user_id UUID, p_mission_id UUID, p_code TEXT DEFAULT NULL, p_note TEXT DEFAULT NULL)
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
  v_description TEXT;
BEGIN
  SELECT * INTO v_mission FROM public.missions WHERE id = p_mission_id AND is_active = TRUE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Mission not found');
  END IF;

  IF v_mission.expires_at IS NOT NULL AND v_mission.expires_at < NOW() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Mission has expired');
  END IF;

  SELECT * INTO v_user FROM public.users WHERE id = p_user_id;

  IF v_mission.unlock_fee > 0 THEN
    SELECT EXISTS(SELECT 1 FROM public.mission_unlocks WHERE user_id = p_user_id AND mission_id = p_mission_id) INTO v_is_unlocked;
    IF NOT v_is_unlocked THEN
      RETURN jsonb_build_object('success', false, 'error', 'Mission not unlocked.');
    END IF;
  END IF;

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
    RETURN jsonb_build_object('success', false, 'error', 'Treasury is empty.');
  END IF;

  INSERT INTO public.mission_completions (user_id, mission_id, completed_at)
  VALUES (p_user_id, p_mission_id, NOW());

  UPDATE public.users SET balance = balance + v_reward, total_earned = total_earned + v_reward WHERE id = p_user_id;

  v_description := 'Mission complete: ' || v_mission.title;
  IF p_note IS NOT NULL AND p_note != '' THEN
    v_description := v_description || ' — ' || p_note;
  END IF;

  INSERT INTO public.transactions (user_id, type, amount, description, reference_id)
  VALUES (p_user_id, 'mission', v_reward, v_description, v_mission.id);

  PERFORM public.record_emission(v_reward);

  RETURN jsonb_build_object('success', true, 'reward', v_reward, 'mission', v_mission.title);
END;
$func$;
