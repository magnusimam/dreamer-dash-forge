-- Remove self-adjust restriction and daily limit for super admins
CREATE OR REPLACE FUNCTION public.admin_adjust_balance(p_admin_id UUID, p_user_id UUID, p_amount INTEGER, p_reason TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  v_admin RECORD;
  v_user RECORD;
BEGIN
  SELECT * INTO v_admin FROM public.users WHERE id = p_admin_id AND is_admin = TRUE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;

  SELECT * INTO v_user FROM public.users WHERE id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  IF v_user.balance + p_amount < 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Would result in negative balance');
  END IF;

  IF p_amount > 0 THEN
    PERFORM public.record_emission(p_amount);
  ELSE
    PERFORM public.record_recycling(ABS(p_amount));
  END IF;

  UPDATE public.users SET
    balance = balance + p_amount,
    total_earned = CASE WHEN p_amount > 0 THEN total_earned + p_amount ELSE total_earned END
  WHERE id = p_user_id;

  INSERT INTO public.transactions (user_id, type, amount, description)
  VALUES (p_user_id, 'bonus', p_amount, 'Admin adjustment: ' || p_reason);

  INSERT INTO public.admin_audit_log (admin_id, action, target_user_id, amount, reason)
  VALUES (p_admin_id, 'balance_adjustment', p_user_id, p_amount, p_reason);

  RETURN jsonb_build_object('success', true, 'new_balance', v_user.balance + p_amount, 'user', v_user.first_name);
END;
$func$;
