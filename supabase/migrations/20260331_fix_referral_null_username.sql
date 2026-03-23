-- Fix: process_referral crashed when referrer has no Telegram username (NULL).
-- The string concat '@' || NULL produces NULL, violating the NOT NULL
-- constraint on transactions.description.
-- Fix: use COALESCE to fall back to first_name when username is NULL.

CREATE OR REPLACE FUNCTION public.process_referral(p_referred_user_id uuid, p_referral_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_referrer public.users;
  v_supply public.token_supply;
  v_referrer_reward INTEGER := 100;
  v_referred_reward INTEGER := 20;
  v_total_cost INTEGER;
BEGIN
  v_total_cost := v_referrer_reward + v_referred_reward;

  SELECT * INTO v_supply FROM public.token_supply WHERE id = 1;

  IF v_supply.referral_pool < v_total_cost THEN
    RETURN jsonb_build_object('success', false, 'error', 'Referral program has ended');
  END IF;

  SELECT * INTO v_referrer FROM public.users WHERE referral_code = p_referral_code;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid referral code');
  END IF;

  IF v_referrer.id = p_referred_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot use your own referral code');
  END IF;

  IF EXISTS(SELECT 1 FROM public.referrals WHERE referred_id = p_referred_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already used a referral code');
  END IF;

  INSERT INTO public.referrals (referrer_id, referred_id, reward_given)
  VALUES (v_referrer.id, p_referred_user_id, true);

  -- Referrer gets 100 DR
  UPDATE public.users SET balance = balance + v_referrer_reward, total_earned = total_earned + v_referrer_reward
  WHERE id = v_referrer.id;

  -- Referred gets 20 DR
  UPDATE public.users SET balance = balance + v_referred_reward, total_earned = total_earned + v_referred_reward
  WHERE id = p_referred_user_id;

  INSERT INTO public.transactions (user_id, type, amount, description)
  VALUES (v_referrer.id, 'bonus', v_referrer_reward, 'Referral bonus: new user joined');

  INSERT INTO public.transactions (user_id, type, amount, description)
  VALUES (p_referred_user_id, 'bonus', v_referred_reward, 'Welcome bonus: referred by ' || COALESCE(v_referrer.username, v_referrer.first_name));

  PERFORM public.record_emission(v_total_cost, 'referral_pool');

  RETURN jsonb_build_object('success', true, 'reward', v_referred_reward, 'referrer', v_referrer.first_name);
END;
$$;
