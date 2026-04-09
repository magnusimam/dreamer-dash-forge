-- Fix: delete activity log entry on proof rejection so user can resubmit
CREATE OR REPLACE FUNCTION public.process_activity_proof(p_admin_id UUID, p_log_id UUID, p_action TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  v_admin RECORD;
  v_log RECORD;
  v_activity RECORD;
  v_user RECORD;
  v_multiplier NUMERIC;
  v_reward INTEGER;
BEGIN
  SELECT * INTO v_admin FROM public.users WHERE id = p_admin_id AND is_admin = TRUE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;

  SELECT * INTO v_log FROM public.activity_logs WHERE id = p_log_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Activity log not found');
  END IF;

  IF v_log.proof_status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already processed');
  END IF;

  IF p_action = 'approved' THEN
    UPDATE public.activity_logs SET proof_status = 'approved' WHERE id = p_log_id;

    SELECT * INTO v_activity FROM public.activities WHERE id = v_log.activity_id;
    SELECT * INTO v_user FROM public.users WHERE id = v_log.user_id;

    v_multiplier := public.get_earning_multiplier(v_user.balance);
    v_reward := GREATEST(FLOOR(v_activity.reward * v_multiplier)::INTEGER, 0);

    IF v_reward > 0 THEN
      UPDATE public.users SET balance = balance + v_reward, total_earned = total_earned + v_reward WHERE id = v_user.id;
      INSERT INTO public.transactions (user_id, type, amount, description, reference_id)
      VALUES (v_user.id, 'earn', v_reward, v_activity.title, v_activity.id);
      PERFORM public.record_emission(v_reward);
    END IF;

    RETURN jsonb_build_object('success', true, 'action', 'approved', 'reward', v_reward, 'user', v_user.first_name, 'telegram_id', v_user.telegram_id);
  ELSE
    -- Delete the entry so user can resubmit
    DELETE FROM public.activity_logs WHERE id = p_log_id;
    RETURN jsonb_build_object('success', true, 'action', 'rejected', 'telegram_id', v_log.user_id);
  END IF;
END;
$func$;
