-- Streak bonus rewards
CREATE TABLE IF NOT EXISTS public.streak_bonuses_claimed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  streak_milestone INTEGER NOT NULL,
  reward INTEGER NOT NULL,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, streak_milestone)
);

ALTER TABLE public.streak_bonuses_claimed ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view streak bonuses" ON public.streak_bonuses_claimed FOR SELECT USING (true);
CREATE POLICY "System can manage streak bonuses" ON public.streak_bonuses_claimed FOR ALL USING (true);

-- Claim streak bonus
CREATE OR REPLACE FUNCTION public.claim_streak_bonus(p_user_id UUID, p_milestone INTEGER)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  v_user RECORD;
  v_already_claimed BOOLEAN;
  v_reward INTEGER;
BEGIN
  -- Validate milestone (must be multiple of 30)
  IF p_milestone < 30 OR p_milestone % 30 != 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid milestone');
  END IF;

  SELECT * INTO v_user FROM public.users WHERE id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  IF v_user.streak < p_milestone THEN
    RETURN jsonb_build_object('success', false, 'error', 'Your streak is ' || v_user.streak || ' days. Need ' || p_milestone || ' days.');
  END IF;

  SELECT EXISTS(SELECT 1 FROM public.streak_bonuses_claimed WHERE user_id = p_user_id AND streak_milestone = p_milestone) INTO v_already_claimed;
  IF v_already_claimed THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already claimed this milestone');
  END IF;

  -- Reward: 500 base + 1000 per additional 30 days
  -- 30d=500, 60d=1500, 90d=2500, 120d=3500, 150d=4500...
  v_reward := 500 + ((p_milestone / 30) - 1) * 1000;

  IF (SELECT treasury_balance FROM public.token_supply WHERE id = 1) < v_reward THEN
    RETURN jsonb_build_object('success', false, 'error', 'Treasury empty');
  END IF;

  INSERT INTO public.streak_bonuses_claimed (user_id, streak_milestone, reward) VALUES (p_user_id, p_milestone, v_reward);
  UPDATE public.users SET balance = balance + v_reward, total_earned = total_earned + v_reward WHERE id = p_user_id;
  INSERT INTO public.transactions (user_id, type, amount, description)
  VALUES (p_user_id, 'bonus', v_reward, p_milestone || '-day streak bonus');
  PERFORM public.record_emission(v_reward);

  RETURN jsonb_build_object('success', true, 'reward', v_reward, 'milestone', p_milestone);
END;
$func$;
