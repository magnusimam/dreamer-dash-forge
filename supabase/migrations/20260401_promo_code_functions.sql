-- Claim a promo code
CREATE OR REPLACE FUNCTION public.claim_promo_code(p_user_id UUID, p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  v_promo RECORD;
  v_user RECORD;
BEGIN
  SELECT * INTO v_user FROM public.users WHERE id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  SELECT * INTO v_promo FROM public.promo_codes WHERE UPPER(code) = UPPER(TRIM(p_code));
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid code');
  END IF;

  IF v_promo.is_used THEN
    RETURN jsonb_build_object('success', false, 'error', 'This code has already been used');
  END IF;

  IF v_user.balance + v_promo.reward > 50000 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Would exceed wallet cap');
  END IF;

  UPDATE public.promo_codes SET is_used = TRUE, claimed_by = p_user_id, claimed_at = NOW() WHERE id = v_promo.id;

  UPDATE public.users SET balance = balance + v_promo.reward, total_earned = total_earned + v_promo.reward WHERE id = p_user_id;

  INSERT INTO public.transactions (user_id, type, amount, description) VALUES (p_user_id, 'promo', v_promo.reward, COALESCE(v_promo.description, 'Promo code reward'));

  PERFORM public.record_emission(v_promo.reward);

  RETURN jsonb_build_object('success', true, 'reward', v_promo.reward, 'description', v_promo.description);
END;
$func$;
