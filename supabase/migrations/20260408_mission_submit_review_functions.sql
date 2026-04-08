-- Submit mission proof for review (no DR yet)
CREATE OR REPLACE FUNCTION public.submit_mission_proof(p_user_id UUID, p_mission_id UUID, p_proof_url TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  v_mission RECORD;
  v_user RECORD;
  v_is_unlocked BOOLEAN;
  v_already_submitted BOOLEAN;
BEGIN
  SELECT * INTO v_mission FROM public.missions WHERE id = p_mission_id AND is_active = TRUE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Mission not found');
  END IF;

  SELECT * INTO v_user FROM public.users WHERE id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  IF v_mission.unlock_fee > 0 THEN
    SELECT EXISTS(SELECT 1 FROM public.mission_unlocks WHERE user_id = p_user_id AND mission_id = p_mission_id) INTO v_is_unlocked;
    IF NOT v_is_unlocked THEN
      RETURN jsonb_build_object('success', false, 'error', 'Mission not unlocked');
    END IF;
  END IF;

  SELECT EXISTS(SELECT 1 FROM public.mission_completions WHERE user_id = p_user_id AND mission_id = p_mission_id) INTO v_already_submitted;
  IF v_already_submitted THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already submitted');
  END IF;

  INSERT INTO public.mission_completions (user_id, mission_id, proof_url, status, completed_at)
  VALUES (p_user_id, p_mission_id, p_proof_url, 'pending', NOW());

  RETURN jsonb_build_object('success', true, 'mission', v_mission.title);
END;
$func$;

-- Admin approve mission submission (credits DR)
CREATE OR REPLACE FUNCTION public.approve_mission_submission(p_admin_id UUID, p_completion_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  v_admin RECORD;
  v_completion RECORD;
  v_mission RECORD;
  v_user RECORD;
  v_multiplier NUMERIC;
  v_reward INTEGER;
BEGIN
  SELECT * INTO v_admin FROM public.users WHERE id = p_admin_id AND is_admin = TRUE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;

  SELECT * INTO v_completion FROM public.mission_completions WHERE id = p_completion_id AND status = 'pending';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Submission not found or already reviewed');
  END IF;

  SELECT * INTO v_mission FROM public.missions WHERE id = v_completion.mission_id;
  SELECT * INTO v_user FROM public.users WHERE id = v_completion.user_id;

  v_multiplier := public.get_earning_multiplier(v_user.balance);
  v_reward := GREATEST(FLOOR(v_mission.reward * v_multiplier)::INTEGER, 0);

  UPDATE public.mission_completions SET status = 'approved', reviewed_at = NOW() WHERE id = p_completion_id;

  IF v_reward > 0 THEN
    UPDATE public.users SET balance = balance + v_reward, total_earned = total_earned + v_reward WHERE id = v_user.id;
    INSERT INTO public.transactions (user_id, type, amount, description, reference_id)
    VALUES (v_user.id, 'mission', v_reward, 'Mission approved: ' || v_mission.title, v_mission.id);
    PERFORM public.record_emission(v_reward);
  END IF;

  RETURN jsonb_build_object('success', true, 'reward', v_reward, 'user', v_user.first_name, 'mission', v_mission.title, 'telegram_id', v_user.telegram_id);
END;
$func$;

-- Admin reject mission submission
CREATE OR REPLACE FUNCTION public.reject_mission_submission(p_admin_id UUID, p_completion_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  v_admin RECORD;
  v_completion RECORD;
BEGIN
  SELECT * INTO v_admin FROM public.users WHERE id = p_admin_id AND is_admin = TRUE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;

  SELECT * INTO v_completion FROM public.mission_completions WHERE id = p_completion_id AND status = 'pending';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Submission not found or already reviewed');
  END IF;

  -- Delete so they can resubmit
  DELETE FROM public.mission_completions WHERE id = p_completion_id;

  RETURN jsonb_build_object('success', true);
END;
$func$;
