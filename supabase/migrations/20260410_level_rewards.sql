-- Level reward claims tracking
CREATE TABLE IF NOT EXISTS public.level_rewards_claimed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  level INTEGER NOT NULL,
  reward INTEGER NOT NULL,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, level)
);

ALTER TABLE public.level_rewards_claimed ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view level rewards" ON public.level_rewards_claimed FOR SELECT USING (true);
CREATE POLICY "System can manage level rewards" ON public.level_rewards_claimed FOR ALL USING (true);

-- Claim a level reward (uses community stats engagement to verify level)
CREATE OR REPLACE FUNCTION public.claim_level_reward(p_user_id UUID, p_level INTEGER)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  v_user RECORD;
  v_already_claimed BOOLEAN;
  v_reward INTEGER;
  v_engagement INTEGER;
  v_required_xp INTEGER;
  v_thresholds INTEGER[] := ARRAY[0, 10, 25, 50, 100, 175, 275, 400, 550, 750, 1000, 1300, 1650, 2050, 2500, 3000, 3600, 4300, 5100, 6000, 7000, 8200, 9600, 11200, 13000, 15000, 17500, 20500, 24000, 28000, 32500, 37500, 43000, 49000, 56000, 64000, 73000, 83000, 94000, 106000, 120000, 135000, 152000, 170000, 190000, 212000, 236000, 262000, 290000, 320000];
BEGIN
  IF p_level < 1 OR p_level > 50 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid level');
  END IF;

  SELECT * INTO v_user FROM public.users WHERE id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  -- Already claimed?
  SELECT EXISTS(SELECT 1 FROM public.level_rewards_claimed WHERE user_id = p_user_id AND level = p_level) INTO v_already_claimed;
  IF v_already_claimed THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already claimed this level');
  END IF;

  -- Calculate engagement points (same formula as community stats)
  SELECT (
    (SELECT COALESCE(COUNT(*), 0) FROM public.mission_completions WHERE user_id = p_user_id AND status = 'approved') * 3 +
    (SELECT COALESCE(COUNT(*), 0) FROM public.activity_logs WHERE user_id = p_user_id) * 2 +
    (SELECT COALESCE(COUNT(*), 0) FROM public.raffle_entries WHERE user_id = p_user_id) +
    (SELECT COALESCE(COUNT(*), 0) FROM public.raffles WHERE winner_id = p_user_id) * 5 +
    (SELECT COALESCE(COUNT(*), 0) FROM public.promo_codes WHERE claimed_by = p_user_id) * 2 +
    (SELECT COALESCE(COUNT(*), 0) FROM public.daily_checkins WHERE user_id = p_user_id) +
    (SELECT COALESCE(COUNT(*), 0) FROM public.transactions WHERE user_id = p_user_id AND type = 'transfer_out') +
    (SELECT COALESCE(COUNT(*), 0) FROM public.hackathon_registrations WHERE user_id = p_user_id) * 3
  ) INTO v_engagement;

  -- Check if user has enough XP for this level
  v_required_xp := v_thresholds[p_level];
  IF v_engagement < v_required_xp THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not enough XP for level ' || p_level);
  END IF;

  -- Calculate reward: 200 * 3^(level-1), capped at 50000
  v_reward := LEAST(200 * POWER(3, p_level - 1)::INTEGER, 50000);

  -- Check treasury
  IF (SELECT treasury_balance FROM public.token_supply WHERE id = 1) < v_reward THEN
    RETURN jsonb_build_object('success', false, 'error', 'Treasury empty, try later');
  END IF;

  -- Award
  INSERT INTO public.level_rewards_claimed (user_id, level, reward) VALUES (p_user_id, p_level, v_reward);
  UPDATE public.users SET balance = balance + v_reward, total_earned = total_earned + v_reward WHERE id = p_user_id;
  INSERT INTO public.transactions (user_id, type, amount, description)
  VALUES (p_user_id, 'bonus', v_reward, 'Level ' || p_level || ' reward');
  PERFORM public.record_emission(v_reward);

  RETURN jsonb_build_object('success', true, 'level', p_level, 'reward', v_reward);
END;
$func$;
