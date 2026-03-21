-- ============================================================
-- DREAMER DASH - Initial Database Schema
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. USERS
-- ============================================================
CREATE TABLE public.users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  telegram_id BIGINT UNIQUE NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT,
  username TEXT,
  photo_url TEXT,
  language_code TEXT DEFAULT 'en',
  balance INTEGER NOT NULL DEFAULT 0,
  total_earned INTEGER NOT NULL DEFAULT 0,
  streak INTEGER NOT NULL DEFAULT 0,
  last_check_in DATE,
  is_admin BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'Bronze',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 2. ACTIVITIES (created by admins)
-- ============================================================
CREATE TABLE public.activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN ('meeting', 'workshop', 'event', 'outreach')),
  date DATE NOT NULL,
  reward INTEGER NOT NULL DEFAULT 0,
  code TEXT UNIQUE NOT NULL,
  max_participants INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 3. ACTIVITY LOGS (user participation)
-- ============================================================
CREATE TABLE public.activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  activity_id UUID NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, activity_id) -- prevent double logging
);

-- ============================================================
-- 4. DAILY CHECK-INS
-- ============================================================
CREATE TABLE public.daily_checkins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  check_in_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reward INTEGER NOT NULL DEFAULT 25,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, check_in_date) -- one check-in per day
);

-- ============================================================
-- 5. HACKATHONS
-- ============================================================
CREATE TABLE public.hackathons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  entry_fee INTEGER NOT NULL DEFAULT 0,
  prize_pool INTEGER NOT NULL DEFAULT 0,
  max_teams INTEGER,
  registered_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'active', 'completed')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 6. HACKATHON REGISTRATIONS
-- ============================================================
CREATE TABLE public.hackathon_registrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  hackathon_id UUID NOT NULL REFERENCES public.hackathons(id) ON DELETE CASCADE,
  registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, hackathon_id) -- prevent double registration
);

-- ============================================================
-- 7. TRANSACTIONS
-- ============================================================
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('earn', 'redeem', 'mission', 'bonus', 'checkin', 'hackathon_fee', 'hackathon_prize')),
  amount INTEGER NOT NULL, -- positive for earn, negative for spend
  description TEXT NOT NULL,
  reference_id UUID, -- optional link to activity/hackathon/mission
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 8. MISSIONS
-- ============================================================
CREATE TABLE public.missions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN ('daily', 'social', 'special')),
  reward INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 9. MISSION COMPLETIONS
-- ============================================================
CREATE TABLE public.mission_completions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  mission_id UUID NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, mission_id) -- prevent double completion
);

-- ============================================================
-- 10. REDEMPTION REQUESTS
-- ============================================================
CREATE TABLE public.redemption_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('airtime', 'data', 'cash', 'books', 'mentorship', 'courses', 'other')),
  amount INTEGER NOT NULL, -- DR amount to redeem
  details JSONB NOT NULL DEFAULT '{}'::jsonb, -- category-specific details
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'fulfilled')),
  admin_notes TEXT,
  processed_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_users_telegram_id ON public.users(telegram_id);
CREATE INDEX idx_activity_logs_user_id ON public.activity_logs(user_id);
CREATE INDEX idx_activity_logs_activity_id ON public.activity_logs(activity_id);
CREATE INDEX idx_daily_checkins_user_id ON public.daily_checkins(user_id);
CREATE INDEX idx_daily_checkins_date ON public.daily_checkins(check_in_date);
CREATE INDEX idx_hackathon_registrations_user_id ON public.hackathon_registrations(user_id);
CREATE INDEX idx_hackathon_registrations_hackathon_id ON public.hackathon_registrations(hackathon_id);
CREATE INDEX idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX idx_transactions_type ON public.transactions(type);
CREATE INDEX idx_transactions_created_at ON public.transactions(created_at DESC);
CREATE INDEX idx_mission_completions_user_id ON public.mission_completions(user_id);
CREATE INDEX idx_redemption_requests_user_id ON public.redemption_requests(user_id);
CREATE INDEX idx_redemption_requests_status ON public.redemption_requests(status);
CREATE INDEX idx_activities_code ON public.activities(code);
CREATE INDEX idx_activities_category ON public.activities(category);
CREATE INDEX idx_hackathons_status ON public.hackathons(status);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hackathons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hackathon_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mission_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.redemption_requests ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- USERS: anyone can read, users can update own profile
CREATE POLICY "Users can view all profiles"
  ON public.users FOR SELECT
  USING (true);

CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE
  USING (telegram_id = (current_setting('app.current_user_telegram_id', true))::BIGINT);

CREATE POLICY "Allow user creation"
  ON public.users FOR INSERT
  WITH CHECK (true);

-- ACTIVITIES: anyone can read, only admins can create
CREATE POLICY "Anyone can view activities"
  ON public.activities FOR SELECT
  USING (true);

CREATE POLICY "Admins can create activities"
  ON public.activities FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = created_by AND is_admin = TRUE
    )
  );

-- ACTIVITY LOGS: users can view own, can insert own
CREATE POLICY "Users can view own activity logs"
  ON public.activity_logs FOR SELECT
  USING (true);

CREATE POLICY "Users can log activities"
  ON public.activity_logs FOR INSERT
  WITH CHECK (true);

-- DAILY CHECK-INS: users can view and create own
CREATE POLICY "Users can view own checkins"
  ON public.daily_checkins FOR SELECT
  USING (true);

CREATE POLICY "Users can create own checkins"
  ON public.daily_checkins FOR INSERT
  WITH CHECK (true);

-- HACKATHONS: anyone can view, admins can create
CREATE POLICY "Anyone can view hackathons"
  ON public.hackathons FOR SELECT
  USING (true);

CREATE POLICY "Admins can create hackathons"
  ON public.hackathons FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = created_by AND is_admin = TRUE
    )
  );

CREATE POLICY "Admins can update hackathons"
  ON public.hackathons FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = created_by AND is_admin = TRUE
    )
  );

-- HACKATHON REGISTRATIONS: users can view and register
CREATE POLICY "Anyone can view registrations"
  ON public.hackathon_registrations FOR SELECT
  USING (true);

CREATE POLICY "Users can register for hackathons"
  ON public.hackathon_registrations FOR INSERT
  WITH CHECK (true);

-- TRANSACTIONS: users can view own
CREATE POLICY "Users can view all transactions"
  ON public.transactions FOR SELECT
  USING (true);

CREATE POLICY "System can create transactions"
  ON public.transactions FOR INSERT
  WITH CHECK (true);

-- MISSIONS: anyone can view
CREATE POLICY "Anyone can view missions"
  ON public.missions FOR SELECT
  USING (true);

CREATE POLICY "Admins can create missions"
  ON public.missions FOR INSERT
  WITH CHECK (true);

-- MISSION COMPLETIONS: users can view and complete
CREATE POLICY "Anyone can view completions"
  ON public.mission_completions FOR SELECT
  USING (true);

CREATE POLICY "Users can complete missions"
  ON public.mission_completions FOR INSERT
  WITH CHECK (true);

-- REDEMPTION REQUESTS: users can view own, create own
CREATE POLICY "Users can view own redemption requests"
  ON public.redemption_requests FOR SELECT
  USING (true);

CREATE POLICY "Users can create redemption requests"
  ON public.redemption_requests FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can update redemption requests"
  ON public.redemption_requests FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = processed_by AND is_admin = TRUE
    )
  );

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_redemption_requests_updated_at
  BEFORE UPDATE ON public.redemption_requests
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- FUNCTION: Upsert user from Telegram data
-- ============================================================
CREATE OR REPLACE FUNCTION public.upsert_telegram_user(
  p_telegram_id BIGINT,
  p_first_name TEXT,
  p_last_name TEXT DEFAULT NULL,
  p_username TEXT DEFAULT NULL,
  p_photo_url TEXT DEFAULT NULL,
  p_language_code TEXT DEFAULT 'en'
)
RETURNS public.users AS $$
DECLARE
  v_user public.users;
BEGIN
  INSERT INTO public.users (telegram_id, first_name, last_name, username, photo_url, language_code)
  VALUES (p_telegram_id, p_first_name, p_last_name, p_username, p_photo_url, p_language_code)
  ON CONFLICT (telegram_id) DO UPDATE SET
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    username = EXCLUDED.username,
    photo_url = EXCLUDED.photo_url,
    language_code = EXCLUDED.language_code,
    updated_at = NOW()
  RETURNING * INTO v_user;

  RETURN v_user;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- FUNCTION: Daily check-in
-- ============================================================
CREATE OR REPLACE FUNCTION public.perform_daily_checkin(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_user public.users;
  v_already_checked_in BOOLEAN;
  v_new_streak INTEGER;
  v_reward INTEGER := 25;
BEGIN
  -- Get user
  SELECT * INTO v_user FROM public.users WHERE id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  -- Check if already checked in today
  SELECT EXISTS(
    SELECT 1 FROM public.daily_checkins
    WHERE user_id = p_user_id AND check_in_date = CURRENT_DATE
  ) INTO v_already_checked_in;

  IF v_already_checked_in THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already checked in today');
  END IF;

  -- Calculate streak
  IF v_user.last_check_in = CURRENT_DATE - INTERVAL '1 day' THEN
    v_new_streak := v_user.streak + 1;
  ELSE
    v_new_streak := 1;
  END IF;

  -- Bonus for streak milestones
  IF v_new_streak % 7 = 0 THEN
    v_reward := v_reward + 50; -- weekly streak bonus
  END IF;

  -- Insert check-in
  INSERT INTO public.daily_checkins (user_id, reward) VALUES (p_user_id, v_reward);

  -- Update user
  UPDATE public.users SET
    balance = balance + v_reward,
    total_earned = total_earned + v_reward,
    streak = v_new_streak,
    last_check_in = CURRENT_DATE
  WHERE id = p_user_id;

  -- Record transaction
  INSERT INTO public.transactions (user_id, type, amount, description)
  VALUES (p_user_id, 'checkin', v_reward, 'Daily check-in (Day ' || v_new_streak || ')');

  RETURN jsonb_build_object(
    'success', true,
    'reward', v_reward,
    'streak', v_new_streak
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- FUNCTION: Log activity with code
-- ============================================================
CREATE OR REPLACE FUNCTION public.log_activity(p_user_id UUID, p_code TEXT)
RETURNS JSONB AS $$
DECLARE
  v_activity public.activities;
  v_already_logged BOOLEAN;
BEGIN
  -- Find activity by code
  SELECT * INTO v_activity FROM public.activities WHERE code = p_code AND is_active = TRUE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid activity code');
  END IF;

  -- Check if already logged
  SELECT EXISTS(
    SELECT 1 FROM public.activity_logs
    WHERE user_id = p_user_id AND activity_id = v_activity.id
  ) INTO v_already_logged;

  IF v_already_logged THEN
    RETURN jsonb_build_object('success', false, 'error', 'Activity already logged');
  END IF;

  -- Check max participants
  IF v_activity.max_participants IS NOT NULL THEN
    IF (SELECT COUNT(*) FROM public.activity_logs WHERE activity_id = v_activity.id) >= v_activity.max_participants THEN
      RETURN jsonb_build_object('success', false, 'error', 'Activity is full');
    END IF;
  END IF;

  -- Log the activity
  INSERT INTO public.activity_logs (user_id, activity_id) VALUES (p_user_id, v_activity.id);

  -- Update user balance
  UPDATE public.users SET
    balance = balance + v_activity.reward,
    total_earned = total_earned + v_activity.reward
  WHERE id = p_user_id;

  -- Record transaction
  INSERT INTO public.transactions (user_id, type, amount, description, reference_id)
  VALUES (p_user_id, 'earn', v_activity.reward, v_activity.title, v_activity.id);

  RETURN jsonb_build_object(
    'success', true,
    'reward', v_activity.reward,
    'activity', v_activity.title
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- FUNCTION: Register for hackathon
-- ============================================================
CREATE OR REPLACE FUNCTION public.register_hackathon(p_user_id UUID, p_hackathon_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_hackathon public.hackathons;
  v_user public.users;
  v_already_registered BOOLEAN;
BEGIN
  -- Get hackathon
  SELECT * INTO v_hackathon FROM public.hackathons WHERE id = p_hackathon_id AND is_active = TRUE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Hackathon not found');
  END IF;

  -- Get user
  SELECT * INTO v_user FROM public.users WHERE id = p_user_id;

  -- Check already registered
  SELECT EXISTS(
    SELECT 1 FROM public.hackathon_registrations
    WHERE user_id = p_user_id AND hackathon_id = p_hackathon_id
  ) INTO v_already_registered;

  IF v_already_registered THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already registered');
  END IF;

  -- Check capacity
  IF v_hackathon.max_teams IS NOT NULL AND v_hackathon.registered_count >= v_hackathon.max_teams THEN
    RETURN jsonb_build_object('success', false, 'error', 'Hackathon is full');
  END IF;

  -- Check balance for entry fee
  IF v_hackathon.entry_fee > 0 AND v_user.balance < v_hackathon.entry_fee THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance');
  END IF;

  -- Deduct entry fee
  IF v_hackathon.entry_fee > 0 THEN
    UPDATE public.users SET balance = balance - v_hackathon.entry_fee WHERE id = p_user_id;

    INSERT INTO public.transactions (user_id, type, amount, description, reference_id)
    VALUES (p_user_id, 'hackathon_fee', -v_hackathon.entry_fee, 'Hackathon entry: ' || v_hackathon.title, v_hackathon.id);
  END IF;

  -- Register
  INSERT INTO public.hackathon_registrations (user_id, hackathon_id) VALUES (p_user_id, p_hackathon_id);

  -- Update count
  UPDATE public.hackathons SET registered_count = registered_count + 1 WHERE id = p_hackathon_id;

  RETURN jsonb_build_object(
    'success', true,
    'hackathon', v_hackathon.title,
    'fee_paid', v_hackathon.entry_fee
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- FUNCTION: Submit redemption request
-- ============================================================
CREATE OR REPLACE FUNCTION public.submit_redemption(
  p_user_id UUID,
  p_category TEXT,
  p_amount INTEGER,
  p_details JSONB
)
RETURNS JSONB AS $$
DECLARE
  v_user public.users;
BEGIN
  -- Get user
  SELECT * INTO v_user FROM public.users WHERE id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  -- Check balance
  IF v_user.balance < p_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance');
  END IF;

  -- Deduct balance
  UPDATE public.users SET balance = balance - p_amount WHERE id = p_user_id;

  -- Create redemption request
  INSERT INTO public.redemption_requests (user_id, category, amount, details)
  VALUES (p_user_id, p_category, p_amount, p_details);

  -- Record transaction
  INSERT INTO public.transactions (user_id, type, amount, description)
  VALUES (p_user_id, 'redeem', -p_amount, 'Redemption: ' || p_category);

  RETURN jsonb_build_object('success', true, 'amount', p_amount, 'category', p_category);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- FUNCTION: Complete mission
-- ============================================================
CREATE OR REPLACE FUNCTION public.complete_mission(p_user_id UUID, p_mission_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_mission public.missions;
  v_already_completed BOOLEAN;
BEGIN
  -- Get mission
  SELECT * INTO v_mission FROM public.missions WHERE id = p_mission_id AND is_active = TRUE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Mission not found');
  END IF;

  -- Check already completed
  SELECT EXISTS(
    SELECT 1 FROM public.mission_completions
    WHERE user_id = p_user_id AND mission_id = p_mission_id
  ) INTO v_already_completed;

  IF v_already_completed THEN
    RETURN jsonb_build_object('success', false, 'error', 'Mission already completed');
  END IF;

  -- Complete mission
  INSERT INTO public.mission_completions (user_id, mission_id) VALUES (p_user_id, p_mission_id);

  -- Update balance
  UPDATE public.users SET
    balance = balance + v_mission.reward,
    total_earned = total_earned + v_mission.reward
  WHERE id = p_user_id;

  -- Record transaction
  INSERT INTO public.transactions (user_id, type, amount, description, reference_id)
  VALUES (p_user_id, 'mission', v_mission.reward, v_mission.title, v_mission.id);

  RETURN jsonb_build_object(
    'success', true,
    'reward', v_mission.reward,
    'mission', v_mission.title
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
