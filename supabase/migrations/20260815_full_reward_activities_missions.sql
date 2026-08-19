-- ============================================================
-- FULL REWARD FOR ACTIVITIES + MISSIONS
-- ------------------------------------------------------------
-- The wallet-cap earning taper (public.get_earning_multiplier, introduced
-- in 20260325_tokenomics.sql) was being applied uniformly to check-ins,
-- activities, and missions: 100% below 20,000 DR balance, 50% at
-- 20,000-34,999, 25% at 35,000-49,999, blocked entirely at 50,000+.
--
-- Decision: check-ins keep the taper. Activities (the Log section) and
-- missions should always pay their full listed reward on completion,
-- regardless of the user's balance. This redefines the four reward paths
-- for those two features to stop calling get_earning_multiplier — the
-- daily check-in path (_perform_daily_checkin) is untouched.
--
-- Bodies below are copied from the live function definitions (confirmed
-- via pg_get_functiondef against the production DB) with only the
-- multiplier calculation removed, to keep every other guard (proof
-- requirements, max participants, treasury balance, already-logged/
-- already-completed checks) byte-for-byte identical to what's live today.
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION public._log_activity(p_user_id uuid, p_code text, p_proof_url text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_activity RECORD;
  v_already_logged BOOLEAN;
  v_user RECORD;
  v_reward INTEGER;
  v_proof_status TEXT;
BEGIN
  SELECT * INTO v_activity FROM public.activities WHERE code = p_code AND is_active = TRUE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Invalid activity code'); END IF;

  SELECT * INTO v_user FROM public.users WHERE id = p_user_id;

  SELECT EXISTS(SELECT 1 FROM public.activity_logs WHERE user_id = p_user_id AND activity_id = v_activity.id) INTO v_already_logged;
  IF v_already_logged THEN RETURN jsonb_build_object('success', false, 'error', 'Activity already logged'); END IF;

  IF v_activity.max_participants IS NOT NULL THEN
    IF (SELECT COUNT(*) FROM public.activity_logs WHERE activity_id = v_activity.id) >= v_activity.max_participants THEN
      RETURN jsonb_build_object('success', false, 'error', 'Activity is full');
    END IF;
  END IF;

  IF v_activity.proof_required AND (p_proof_url IS NULL OR p_proof_url = '') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Proof is required for this activity');
  END IF;

  IF v_activity.proof_required THEN v_proof_status := 'pending'; ELSE v_proof_status := 'not_required'; END IF;

  v_reward := GREATEST(v_activity.reward, 0);

  IF (SELECT treasury_balance FROM public.token_supply WHERE id = 1) < v_reward THEN
    RETURN jsonb_build_object('success', false, 'error', 'Treasury is empty. Try again later.');
  END IF;

  INSERT INTO public.activity_logs (user_id, activity_id, proof_image_url, proof_status)
  VALUES (p_user_id, v_activity.id, p_proof_url, v_proof_status);

  IF v_proof_status = 'pending' THEN
    RETURN jsonb_build_object('success', true, 'pending_approval', true, 'activity', v_activity.title);
  END IF;

  UPDATE public.users SET balance = balance + v_reward, total_earned = total_earned + v_reward WHERE id = p_user_id;

  INSERT INTO public.transactions (user_id, type, amount, description, reference_id)
  VALUES (p_user_id, 'earn', v_reward, v_activity.title, v_activity.id);

  PERFORM public.record_emission(v_reward);

  RETURN jsonb_build_object('success', true, 'reward', v_reward, 'activity', v_activity.title);
END;
$function$;

CREATE OR REPLACE FUNCTION public._process_activity_proof(p_admin_id uuid, p_log_id uuid, p_action text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_admin RECORD;
  v_log RECORD;
  v_activity RECORD;
  v_user RECORD;
  v_reward INTEGER;
BEGIN
  SELECT * INTO v_admin FROM public.users WHERE id = p_admin_id AND is_admin = TRUE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Not authorized'); END IF;

  SELECT * INTO v_log FROM public.activity_logs WHERE id = p_log_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Activity log not found'); END IF;
  IF v_log.proof_status != 'pending' THEN RETURN jsonb_build_object('success', false, 'error', 'Already processed'); END IF;

  IF p_action = 'approved' THEN
    UPDATE public.activity_logs SET proof_status = 'approved' WHERE id = p_log_id;
    SELECT * INTO v_activity FROM public.activities WHERE id = v_log.activity_id;
    SELECT * INTO v_user FROM public.users WHERE id = v_log.user_id;

    v_reward := GREATEST(v_activity.reward, 0);

    IF v_reward > 0 THEN
      UPDATE public.users SET balance = balance + v_reward, total_earned = total_earned + v_reward WHERE id = v_user.id;
      INSERT INTO public.transactions (user_id, type, amount, description, reference_id)
      VALUES (v_user.id, 'earn', v_reward, v_activity.title, v_activity.id);
      PERFORM public.record_emission(v_reward);
    END IF;

    RETURN jsonb_build_object('success', true, 'action', 'approved', 'reward', v_reward, 'user', v_user.first_name, 'telegram_id', v_user.telegram_id);
  ELSE
    DELETE FROM public.activity_logs WHERE id = p_log_id;
    RETURN jsonb_build_object('success', true, 'action', 'rejected', 'telegram_id', v_log.user_id);
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public._complete_mission(p_user_id uuid, p_mission_id uuid, p_code text DEFAULT NULL::text, p_note text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_mission RECORD;
  v_user RECORD;
  v_already_completed BOOLEAN;
  v_is_unlocked BOOLEAN;
  v_reward INTEGER;
  v_description TEXT;
BEGIN
  SELECT * INTO v_mission FROM public.missions WHERE id = p_mission_id AND is_active = TRUE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Mission not found'); END IF;
  IF v_mission.expires_at IS NOT NULL AND v_mission.expires_at < NOW() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Mission has expired');
  END IF;

  SELECT * INTO v_user FROM public.users WHERE id = p_user_id;

  IF v_mission.unlock_fee > 0 THEN
    SELECT EXISTS(SELECT 1 FROM public.mission_unlocks WHERE user_id = p_user_id AND mission_id = p_mission_id) INTO v_is_unlocked;
    IF NOT v_is_unlocked THEN RETURN jsonb_build_object('success', false, 'error', 'Mission not unlocked.'); END IF;
  END IF;

  IF v_mission.completion_code IS NOT NULL AND v_mission.completion_code != '' THEN
    IF p_code IS NULL OR UPPER(TRIM(p_code)) != UPPER(TRIM(v_mission.completion_code)) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid completion code');
    END IF;
  END IF;

  SELECT EXISTS(SELECT 1 FROM public.mission_completions WHERE user_id = p_user_id AND mission_id = p_mission_id) INTO v_already_completed;
  IF v_already_completed THEN RETURN jsonb_build_object('success', false, 'error', 'Mission already completed'); END IF;

  v_reward := GREATEST(v_mission.reward, 0);

  IF (SELECT treasury_balance FROM public.token_supply WHERE id = 1) < v_reward THEN
    RETURN jsonb_build_object('success', false, 'error', 'Treasury is empty.');
  END IF;

  INSERT INTO public.mission_completions (user_id, mission_id, completed_at) VALUES (p_user_id, p_mission_id, NOW());
  UPDATE public.users SET balance = balance + v_reward, total_earned = total_earned + v_reward WHERE id = p_user_id;

  v_description := 'Mission complete: ' || v_mission.title;
  IF p_note IS NOT NULL AND p_note != '' THEN v_description := v_description || ' — ' || p_note; END IF;

  INSERT INTO public.transactions (user_id, type, amount, description, reference_id)
  VALUES (p_user_id, 'mission', v_reward, v_description, v_mission.id);

  PERFORM public.record_emission(v_reward);

  RETURN jsonb_build_object('success', true, 'reward', v_reward, 'mission', v_mission.title);
END;
$function$;

CREATE OR REPLACE FUNCTION public._approve_mission_submission(p_admin_id uuid, p_completion_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_admin RECORD;
  v_completion RECORD;
  v_mission RECORD;
  v_user RECORD;
  v_reward INTEGER;
BEGIN
  SELECT * INTO v_admin FROM public.users WHERE id = p_admin_id AND is_admin = TRUE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Not authorized'); END IF;

  SELECT * INTO v_completion FROM public.mission_completions WHERE id = p_completion_id AND status = 'pending';
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Submission not found or already reviewed'); END IF;

  SELECT * INTO v_mission FROM public.missions WHERE id = v_completion.mission_id;
  SELECT * INTO v_user FROM public.users WHERE id = v_completion.user_id;

  v_reward := GREATEST(v_mission.reward, 0);

  UPDATE public.mission_completions SET status = 'approved', reviewed_at = NOW() WHERE id = p_completion_id;

  IF v_reward > 0 THEN
    UPDATE public.users SET balance = balance + v_reward, total_earned = total_earned + v_reward WHERE id = v_user.id;
    INSERT INTO public.transactions (user_id, type, amount, description, reference_id)
    VALUES (v_user.id, 'mission', v_reward, 'Mission approved: ' || v_mission.title, v_mission.id);
    PERFORM public.record_emission(v_reward);
  END IF;

  RETURN jsonb_build_object('success', true, 'reward', v_reward, 'user', v_user.first_name, 'mission', v_mission.title, 'telegram_id', v_user.telegram_id);
END;
$function$;

COMMIT;
