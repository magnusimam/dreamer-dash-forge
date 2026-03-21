-- ============================================================
-- MISSIONS: Add expiry & daily reset support
-- ============================================================

ALTER TABLE public.missions ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE public.missions ADD COLUMN IF NOT EXISTS is_daily BOOLEAN NOT NULL DEFAULT FALSE;

-- Allow daily missions to be completed again after reset
-- Remove unique constraint for daily missions by adding a date component
ALTER TABLE public.mission_completions ADD COLUMN IF NOT EXISTS completed_date DATE NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE public.mission_completions DROP CONSTRAINT IF EXISTS mission_completions_user_id_mission_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS mission_completions_user_mission_date ON public.mission_completions(user_id, mission_id, completed_date);

-- Function to check if daily mission was already done today
CREATE OR REPLACE FUNCTION public.complete_mission(p_user_id UUID, p_mission_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_mission public.missions;
  v_already_completed BOOLEAN;
BEGIN
  SELECT * INTO v_mission FROM public.missions WHERE id = p_mission_id AND is_active = TRUE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Mission not found');
  END IF;

  -- Check expiry
  IF v_mission.expires_at IS NOT NULL AND v_mission.expires_at < NOW() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Mission has expired');
  END IF;

  -- For daily missions, check today only; for regular missions, check ever
  IF v_mission.is_daily THEN
    SELECT EXISTS(
      SELECT 1 FROM public.mission_completions
      WHERE user_id = p_user_id AND mission_id = p_mission_id AND completed_date = CURRENT_DATE
    ) INTO v_already_completed;
  ELSE
    SELECT EXISTS(
      SELECT 1 FROM public.mission_completions
      WHERE user_id = p_user_id AND mission_id = p_mission_id
    ) INTO v_already_completed;
  END IF;

  IF v_already_completed THEN
    RETURN jsonb_build_object('success', false, 'error', 'Mission already completed');
  END IF;

  INSERT INTO public.mission_completions (user_id, mission_id, completed_date)
  VALUES (p_user_id, p_mission_id, CURRENT_DATE);

  UPDATE public.users SET
    balance = balance + v_mission.reward,
    total_earned = total_earned + v_mission.reward
  WHERE id = p_user_id;

  INSERT INTO public.transactions (user_id, type, amount, description, reference_id)
  VALUES (p_user_id, 'mission', v_mission.reward, v_mission.title, v_mission.id);

  RETURN jsonb_build_object('success', true, 'reward', v_mission.reward, 'mission', v_mission.title);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- REFERRALS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.referrals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  referrer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  referred_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reward_given BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(referred_id) -- each user can only be referred once
);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own referrals"
  ON public.referrals FOR SELECT USING (true);

CREATE POLICY "System can create referrals"
  ON public.referrals FOR INSERT WITH CHECK (true);

-- Add referral code to users
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;

-- Generate referral codes for existing users
UPDATE public.users SET referral_code = 'DR-' || UPPER(SUBSTRING(id::text, 1, 8))
WHERE referral_code IS NULL;

-- Function to process referral
CREATE OR REPLACE FUNCTION public.process_referral(
  p_referred_user_id UUID,
  p_referral_code TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_referrer public.users;
  v_reward INTEGER := 100;
BEGIN
  -- Find referrer
  SELECT * INTO v_referrer FROM public.users WHERE referral_code = p_referral_code;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid referral code');
  END IF;

  -- Cannot refer self
  IF v_referrer.id = p_referred_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot use your own referral code');
  END IF;

  -- Check if already referred
  IF EXISTS(SELECT 1 FROM public.referrals WHERE referred_id = p_referred_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already used a referral code');
  END IF;

  -- Create referral record
  INSERT INTO public.referrals (referrer_id, referred_id, reward_given)
  VALUES (v_referrer.id, p_referred_user_id, true);

  -- Reward both users
  UPDATE public.users SET balance = balance + v_reward, total_earned = total_earned + v_reward
  WHERE id IN (v_referrer.id, p_referred_user_id);

  -- Log transactions
  INSERT INTO public.transactions (user_id, type, amount, description)
  VALUES (v_referrer.id, 'bonus', v_reward, 'Referral bonus: new user joined');

  INSERT INTO public.transactions (user_id, type, amount, description)
  VALUES (p_referred_user_id, 'bonus', v_reward, 'Welcome bonus: referred by @' || v_referrer.username);

  RETURN jsonb_build_object('success', true, 'reward', v_reward, 'referrer', v_referrer.first_name);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- ACHIEVEMENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.achievements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  icon TEXT NOT NULL DEFAULT 'trophy',
  condition_type TEXT NOT NULL, -- 'total_earned', 'streak', 'missions_completed', 'activities_logged', 'referrals'
  condition_value INTEGER NOT NULL,
  reward INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_achievements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  achievement_id UUID NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, achievement_id)
);

ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view achievements" ON public.achievements FOR SELECT USING (true);
CREATE POLICY "Anyone can view user achievements" ON public.user_achievements FOR SELECT USING (true);
CREATE POLICY "System can grant achievements" ON public.user_achievements FOR INSERT WITH CHECK (true);

-- Seed default achievements
INSERT INTO public.achievements (title, description, icon, condition_type, condition_value, reward) VALUES
  ('First Steps', 'Earn your first 100 DR', 'baby', 'total_earned', 100, 25),
  ('Rising Star', 'Earn 1,000 DR total', 'star', 'total_earned', 1000, 50),
  ('Go-Getter', 'Earn 5,000 DR total', 'rocket', 'total_earned', 5000, 100),
  ('Legend', 'Earn 20,000 DR total', 'crown', 'total_earned', 20000, 250),
  ('Diamond Hands', 'Earn 50,000 DR total', 'gem', 'total_earned', 50000, 500),
  ('Streak Starter', 'Reach a 3-day streak', 'flame', 'streak', 3, 25),
  ('Week Warrior', 'Reach a 7-day streak', 'flame', 'streak', 7, 75),
  ('Monthly Master', 'Reach a 30-day streak', 'flame', 'streak', 30, 300),
  ('Social Butterfly', 'Refer 3 friends', 'users', 'referrals', 3, 150),
  ('Ambassador', 'Refer 10 friends', 'megaphone', 'referrals', 10, 500)
ON CONFLICT DO NOTHING;

-- Function to check and grant achievements
CREATE OR REPLACE FUNCTION public.check_achievements(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_user public.users;
  v_achievement RECORD;
  v_current_value INTEGER;
  v_newly_unlocked JSONB := '[]'::jsonb;
BEGIN
  SELECT * INTO v_user FROM public.users WHERE id = p_user_id;
  IF NOT FOUND THEN RETURN '[]'::jsonb; END IF;

  FOR v_achievement IN SELECT * FROM public.achievements LOOP
    -- Skip if already unlocked
    IF EXISTS(SELECT 1 FROM public.user_achievements WHERE user_id = p_user_id AND achievement_id = v_achievement.id) THEN
      CONTINUE;
    END IF;

    -- Get current value based on condition type
    CASE v_achievement.condition_type
      WHEN 'total_earned' THEN v_current_value := v_user.total_earned;
      WHEN 'streak' THEN v_current_value := v_user.streak;
      WHEN 'referrals' THEN
        SELECT COUNT(*) INTO v_current_value FROM public.referrals WHERE referrer_id = p_user_id;
      ELSE v_current_value := 0;
    END CASE;

    -- Check if condition is met
    IF v_current_value >= v_achievement.condition_value THEN
      INSERT INTO public.user_achievements (user_id, achievement_id) VALUES (p_user_id, v_achievement.id);

      -- Grant reward
      IF v_achievement.reward > 0 THEN
        UPDATE public.users SET balance = balance + v_achievement.reward, total_earned = total_earned + v_achievement.reward
        WHERE id = p_user_id;

        INSERT INTO public.transactions (user_id, type, amount, description)
        VALUES (p_user_id, 'bonus', v_achievement.reward, 'Achievement: ' || v_achievement.title);
      END IF;

      v_newly_unlocked := v_newly_unlocked || jsonb_build_object('title', v_achievement.title, 'reward', v_achievement.reward);
    END IF;
  END LOOP;

  RETURN v_newly_unlocked;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
