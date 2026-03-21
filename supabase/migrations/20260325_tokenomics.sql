-- ============================================================
-- DREAMERS COIN TOKENOMICS — 21M Fixed Supply, No Burn
-- ============================================================

-- Global supply tracking table
CREATE TABLE IF NOT EXISTS public.token_supply (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1), -- singleton row
  total_supply INTEGER NOT NULL DEFAULT 21000000,
  treasury_balance INTEGER NOT NULL DEFAULT 15000000,
  hackathon_pool INTEGER NOT NULL DEFAULT 2000000,
  referral_pool INTEGER NOT NULL DEFAULT 1000000,
  team_pool INTEGER NOT NULL DEFAULT 3000000,
  team_vested INTEGER NOT NULL DEFAULT 0,
  total_circulating INTEGER NOT NULL DEFAULT 0,
  total_distributed INTEGER NOT NULL DEFAULT 0,
  today_distributed INTEGER NOT NULL DEFAULT 0,
  today_date DATE NOT NULL DEFAULT CURRENT_DATE,
  daily_cap INTEGER NOT NULL DEFAULT 5000,
  halving_interval_days INTEGER NOT NULL DEFAULT 365,
  launch_date DATE NOT NULL DEFAULT CURRENT_DATE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.token_supply ENABLE ROW LEVEL SECURITY;

-- Everyone can read supply stats
CREATE POLICY "Anyone can view token supply"
  ON public.token_supply FOR SELECT USING (true);

-- Only system functions can update
CREATE POLICY "System can update token supply"
  ON public.token_supply FOR UPDATE USING (true);

-- Initialize the singleton row
INSERT INTO public.token_supply (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Sync total_circulating from actual user balances
UPDATE public.token_supply SET
  total_circulating = COALESCE((SELECT SUM(balance) FROM public.users), 0);

-- ============================================================
-- Admin audit log
-- ============================================================

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id UUID NOT NULL REFERENCES public.users(id),
  action TEXT NOT NULL,
  target_user_id UUID REFERENCES public.users(id),
  amount INTEGER,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view audit log"
  ON public.admin_audit_log FOR SELECT USING (true);

CREATE POLICY "System can insert audit log"
  ON public.admin_audit_log FOR INSERT WITH CHECK (true);

CREATE INDEX idx_audit_log_created ON public.admin_audit_log(created_at DESC);

-- ============================================================
-- FUNCTION: Get current daily cap (with halving)
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_current_daily_cap()
RETURNS INTEGER AS $$
DECLARE
  v_supply public.token_supply;
  v_days_since_launch INTEGER;
  v_halvings INTEGER;
  v_cap INTEGER;
BEGIN
  SELECT * INTO v_supply FROM public.token_supply WHERE id = 1;
  v_days_since_launch := CURRENT_DATE - v_supply.launch_date;
  v_halvings := v_days_since_launch / v_supply.halving_interval_days;
  v_cap := GREATEST(v_supply.daily_cap / POWER(2, v_halvings)::INTEGER, 312);
  RETURN v_cap;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================
-- FUNCTION: Check if emission is allowed
-- ============================================================

CREATE OR REPLACE FUNCTION public.can_emit(p_amount INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
  v_supply public.token_supply;
  v_cap INTEGER;
BEGIN
  SELECT * INTO v_supply FROM public.token_supply WHERE id = 1;

  -- Reset daily counter if new day
  IF v_supply.today_date < CURRENT_DATE THEN
    UPDATE public.token_supply SET today_distributed = 0, today_date = CURRENT_DATE WHERE id = 1;
    v_supply.today_distributed := 0;
  END IF;

  v_cap := public.get_current_daily_cap();

  -- Check daily cap
  IF v_supply.today_distributed + p_amount > v_cap THEN
    RETURN FALSE;
  END IF;

  -- Check treasury has enough
  IF v_supply.treasury_balance < p_amount THEN
    RETURN FALSE;
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- FUNCTION: Record emission (deduct from treasury)
-- ============================================================

CREATE OR REPLACE FUNCTION public.record_emission(p_amount INTEGER, p_source TEXT DEFAULT 'treasury')
RETURNS VOID AS $$
BEGIN
  IF p_source = 'treasury' THEN
    UPDATE public.token_supply SET
      treasury_balance = treasury_balance - p_amount,
      total_circulating = total_circulating + p_amount,
      total_distributed = total_distributed + p_amount,
      today_distributed = today_distributed + p_amount,
      updated_at = NOW()
    WHERE id = 1;
  ELSIF p_source = 'referral_pool' THEN
    UPDATE public.token_supply SET
      referral_pool = referral_pool - p_amount,
      total_circulating = total_circulating + p_amount,
      total_distributed = total_distributed + p_amount,
      today_distributed = today_distributed + p_amount,
      updated_at = NOW()
    WHERE id = 1;
  ELSIF p_source = 'hackathon_pool' THEN
    UPDATE public.token_supply SET
      hackathon_pool = hackathon_pool - p_amount,
      total_circulating = total_circulating + p_amount,
      total_distributed = total_distributed + p_amount,
      updated_at = NOW()
    WHERE id = 1;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- FUNCTION: Record recycling (return to treasury)
-- ============================================================

CREATE OR REPLACE FUNCTION public.record_recycling(p_amount INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE public.token_supply SET
    treasury_balance = treasury_balance + p_amount,
    total_circulating = total_circulating - p_amount,
    updated_at = NOW()
  WHERE id = 1;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- FUNCTION: Get earning multiplier based on wallet balance
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_earning_multiplier(p_balance INTEGER)
RETURNS NUMERIC AS $$
BEGIN
  IF p_balance >= 50000 THEN RETURN 0;        -- wallet cap reached
  ELSIF p_balance >= 35000 THEN RETURN 0.25;   -- 25% earning rate
  ELSIF p_balance >= 20000 THEN RETURN 0.50;   -- 50% earning rate
  ELSE RETURN 1.0;                             -- 100% earning rate
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================
-- REPLACE: Daily check-in with tokenomics
-- ============================================================

CREATE OR REPLACE FUNCTION public.perform_daily_checkin(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_user public.users;
  v_already_checked_in BOOLEAN;
  v_new_streak INTEGER;
  v_base_reward INTEGER := 25;
  v_multiplier NUMERIC;
  v_reward INTEGER;
BEGIN
  SELECT * INTO v_user FROM public.users WHERE id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

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

  IF v_new_streak % 7 = 0 THEN
    v_base_reward := v_base_reward + 50;
  END IF;

  -- Apply earning multiplier based on balance
  v_multiplier := public.get_earning_multiplier(v_user.balance);
  v_reward := GREATEST(FLOOR(v_base_reward * v_multiplier)::INTEGER, 0);

  IF v_reward = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet cap reached. Spend some DR to earn more.');
  END IF;

  -- Check emission allowed
  IF NOT public.can_emit(v_reward) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Daily distribution limit reached. Try again tomorrow.');
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

  -- Record emission
  PERFORM public.record_emission(v_reward);

  RETURN jsonb_build_object('success', true, 'reward', v_reward, 'streak', v_new_streak);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- REPLACE: Log activity with tokenomics
-- ============================================================

CREATE OR REPLACE FUNCTION public.log_activity(p_user_id UUID, p_code TEXT)
RETURNS JSONB AS $$
DECLARE
  v_activity public.activities;
  v_already_logged BOOLEAN;
  v_user public.users;
  v_multiplier NUMERIC;
  v_reward INTEGER;
BEGIN
  SELECT * INTO v_activity FROM public.activities WHERE code = p_code AND is_active = TRUE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid activity code');
  END IF;

  SELECT * INTO v_user FROM public.users WHERE id = p_user_id;

  SELECT EXISTS(
    SELECT 1 FROM public.activity_logs WHERE user_id = p_user_id AND activity_id = v_activity.id
  ) INTO v_already_logged;

  IF v_already_logged THEN
    RETURN jsonb_build_object('success', false, 'error', 'Activity already logged');
  END IF;

  IF v_activity.max_participants IS NOT NULL THEN
    IF (SELECT COUNT(*) FROM public.activity_logs WHERE activity_id = v_activity.id) >= v_activity.max_participants THEN
      RETURN jsonb_build_object('success', false, 'error', 'Activity is full');
    END IF;
  END IF;

  -- Apply earning multiplier
  v_multiplier := public.get_earning_multiplier(v_user.balance);
  v_reward := GREATEST(FLOOR(v_activity.reward * v_multiplier)::INTEGER, 0);

  IF v_reward = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet cap reached. Spend some DR to earn more.');
  END IF;

  IF NOT public.can_emit(v_reward) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Daily distribution limit reached.');
  END IF;

  INSERT INTO public.activity_logs (user_id, activity_id) VALUES (p_user_id, v_activity.id);

  UPDATE public.users SET
    balance = balance + v_reward,
    total_earned = total_earned + v_reward
  WHERE id = p_user_id;

  INSERT INTO public.transactions (user_id, type, amount, description, reference_id)
  VALUES (p_user_id, 'earn', v_reward, v_activity.title, v_activity.id);

  PERFORM public.record_emission(v_reward);

  RETURN jsonb_build_object('success', true, 'reward', v_reward, 'activity', v_activity.title);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- REPLACE: Complete mission with tokenomics
-- ============================================================

CREATE OR REPLACE FUNCTION public.complete_mission(p_user_id UUID, p_mission_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_mission public.missions;
  v_user public.users;
  v_already_completed BOOLEAN;
  v_multiplier NUMERIC;
  v_reward INTEGER;
BEGIN
  SELECT * INTO v_mission FROM public.missions WHERE id = p_mission_id AND is_active = TRUE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Mission not found');
  END IF;

  IF v_mission.expires_at IS NOT NULL AND v_mission.expires_at < NOW() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Mission has expired');
  END IF;

  SELECT * INTO v_user FROM public.users WHERE id = p_user_id;

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

  v_multiplier := public.get_earning_multiplier(v_user.balance);
  v_reward := GREATEST(FLOOR(v_mission.reward * v_multiplier)::INTEGER, 0);

  IF v_reward = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet cap reached.');
  END IF;

  IF NOT public.can_emit(v_reward) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Daily distribution limit reached.');
  END IF;

  INSERT INTO public.mission_completions (user_id, mission_id, completed_date)
  VALUES (p_user_id, p_mission_id, CURRENT_DATE);

  UPDATE public.users SET
    balance = balance + v_reward,
    total_earned = total_earned + v_reward
  WHERE id = p_user_id;

  INSERT INTO public.transactions (user_id, type, amount, description, reference_id)
  VALUES (p_user_id, 'mission', v_reward, v_mission.title, v_mission.id);

  PERFORM public.record_emission(v_reward);

  RETURN jsonb_build_object('success', true, 'reward', v_reward, 'mission', v_mission.title);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- REPLACE: Transfer with 2% fee recycling
-- ============================================================

CREATE OR REPLACE FUNCTION public.transfer_dr(
  p_sender_id UUID,
  p_recipient_username TEXT,
  p_amount INTEGER,
  p_note TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_sender public.users;
  v_recipient public.users;
  v_fee INTEGER;
  v_total_deduct INTEGER;
BEGIN
  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount must be positive');
  END IF;

  IF p_amount < 10 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Minimum transfer is 10 DR');
  END IF;

  SELECT * INTO v_sender FROM public.users WHERE id = p_sender_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sender not found');
  END IF;

  SELECT * INTO v_recipient FROM public.users WHERE LOWER(username) = LOWER(p_recipient_username);
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Recipient not found. Check the username.');
  END IF;

  IF v_sender.id = v_recipient.id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot transfer to yourself');
  END IF;

  -- Check recipient wallet cap
  IF v_recipient.balance + p_amount > 50000 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Recipient wallet cap would be exceeded');
  END IF;

  -- Calculate 2% fee
  v_fee := GREATEST(FLOOR(p_amount * 0.02)::INTEGER, 1);
  v_total_deduct := p_amount + v_fee;

  IF v_sender.balance < v_total_deduct THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance (amount + 2% fee)');
  END IF;

  -- Deduct from sender
  UPDATE public.users SET balance = balance - v_total_deduct WHERE id = v_sender.id;

  -- Credit recipient
  UPDATE public.users SET balance = balance + p_amount WHERE id = v_recipient.id;

  -- Sender transaction
  INSERT INTO public.transactions (user_id, type, amount, description)
  VALUES (v_sender.id, 'transfer_out', -v_total_deduct,
    'Transfer to @' || v_recipient.username || ' (' || v_fee || ' DR fee)' || COALESCE(': ' || p_note, ''));

  -- Recipient transaction
  INSERT INTO public.transactions (user_id, type, amount, description)
  VALUES (v_recipient.id, 'transfer_in', p_amount,
    'Transfer from @' || COALESCE(v_sender.username, v_sender.first_name) || COALESCE(': ' || p_note, ''));

  -- Recycle fee to treasury
  PERFORM public.record_recycling(v_fee);

  RETURN jsonb_build_object('success', true, 'amount', p_amount, 'fee', v_fee,
    'recipient', v_recipient.first_name, 'recipient_username', v_recipient.username);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- REPLACE: Redemption — 100% recycled to treasury
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
  SELECT * INTO v_user FROM public.users WHERE id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  IF v_user.balance < p_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance');
  END IF;

  -- Deduct from user
  UPDATE public.users SET balance = balance - p_amount WHERE id = p_user_id;

  -- Create redemption request
  INSERT INTO public.redemption_requests (user_id, category, amount, details)
  VALUES (p_user_id, p_category, p_amount, p_details);

  -- Record transaction
  INSERT INTO public.transactions (user_id, type, amount, description)
  VALUES (p_user_id, 'redeem', -p_amount, 'Redemption: ' || p_category);

  -- 100% recycled to treasury
  PERFORM public.record_recycling(p_amount);

  RETURN jsonb_build_object('success', true, 'amount', p_amount, 'category', p_category);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- REPLACE: Admin adjust balance with limits + audit
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_adjust_balance(
  p_admin_id UUID,
  p_user_id UUID,
  p_amount INTEGER,
  p_reason TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_admin public.users;
  v_user public.users;
  v_today_total INTEGER;
BEGIN
  SELECT * INTO v_admin FROM public.users WHERE id = p_admin_id AND is_admin = TRUE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;

  -- Cannot adjust own balance
  IF p_admin_id = p_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot adjust your own balance');
  END IF;

  -- Check admin daily limit (5000 DR)
  SELECT COALESCE(SUM(ABS(amount)), 0) INTO v_today_total
  FROM public.admin_audit_log
  WHERE admin_id = p_admin_id AND created_at::date = CURRENT_DATE;

  IF v_today_total + ABS(p_amount) > 5000 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Admin daily adjustment limit reached (5,000 DR/day)');
  END IF;

  SELECT * INTO v_user FROM public.users WHERE id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  IF v_user.balance + p_amount < 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Would result in negative balance');
  END IF;

  -- Check wallet cap for positive adjustments
  IF p_amount > 0 AND v_user.balance + p_amount > 50000 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Would exceed wallet cap (50,000 DR)');
  END IF;

  -- For positive adjustments, check emission
  IF p_amount > 0 THEN
    IF NOT public.can_emit(p_amount) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Daily distribution limit reached or treasury empty');
    END IF;
    PERFORM public.record_emission(p_amount);
  ELSE
    -- Negative adjustment returns coins to treasury
    PERFORM public.record_recycling(ABS(p_amount));
  END IF;

  -- Adjust balance
  UPDATE public.users SET
    balance = balance + p_amount,
    total_earned = CASE WHEN p_amount > 0 THEN total_earned + p_amount ELSE total_earned END
  WHERE id = p_user_id;

  -- Record transaction
  INSERT INTO public.transactions (user_id, type, amount, description)
  VALUES (p_user_id, 'bonus', p_amount, 'Admin adjustment: ' || p_reason);

  -- Audit log
  INSERT INTO public.admin_audit_log (admin_id, action, target_user_id, amount, reason)
  VALUES (p_admin_id, 'balance_adjustment', p_user_id, p_amount, p_reason);

  RETURN jsonb_build_object('success', true, 'new_balance', v_user.balance + p_amount, 'user', v_user.first_name);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- REPLACE: Referral with pool tracking
-- ============================================================

CREATE OR REPLACE FUNCTION public.process_referral(
  p_referred_user_id UUID,
  p_referral_code TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_referrer public.users;
  v_supply public.token_supply;
  v_reward INTEGER := 100;
BEGIN
  SELECT * INTO v_supply FROM public.token_supply WHERE id = 1;

  -- Check referral pool
  IF v_supply.referral_pool < v_reward * 2 THEN
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

  UPDATE public.users SET balance = balance + v_reward, total_earned = total_earned + v_reward
  WHERE id IN (v_referrer.id, p_referred_user_id);

  INSERT INTO public.transactions (user_id, type, amount, description)
  VALUES (v_referrer.id, 'bonus', v_reward, 'Referral bonus: new user joined');

  INSERT INTO public.transactions (user_id, type, amount, description)
  VALUES (p_referred_user_id, 'bonus', v_reward, 'Welcome bonus: referred by @' || v_referrer.username);

  -- Deduct from referral pool
  PERFORM public.record_emission(v_reward * 2, 'referral_pool');

  RETURN jsonb_build_object('success', true, 'reward', v_reward, 'referrer', v_referrer.first_name);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- REPLACE: Hackathon registration — recycle fees
-- ============================================================

CREATE OR REPLACE FUNCTION public.register_hackathon(p_user_id UUID, p_hackathon_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_hackathon public.hackathons;
  v_user public.users;
  v_already_registered BOOLEAN;
BEGIN
  SELECT * INTO v_hackathon FROM public.hackathons WHERE id = p_hackathon_id AND is_active = TRUE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Hackathon not found');
  END IF;

  SELECT * INTO v_user FROM public.users WHERE id = p_user_id;

  SELECT EXISTS(
    SELECT 1 FROM public.hackathon_registrations
    WHERE user_id = p_user_id AND hackathon_id = p_hackathon_id
  ) INTO v_already_registered;

  IF v_already_registered THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already registered');
  END IF;

  IF v_hackathon.max_teams IS NOT NULL AND v_hackathon.registered_count >= v_hackathon.max_teams THEN
    RETURN jsonb_build_object('success', false, 'error', 'Hackathon is full');
  END IF;

  IF v_hackathon.entry_fee > 0 AND v_user.balance < v_hackathon.entry_fee THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance');
  END IF;

  IF v_hackathon.entry_fee > 0 THEN
    UPDATE public.users SET balance = balance - v_hackathon.entry_fee WHERE id = p_user_id;

    INSERT INTO public.transactions (user_id, type, amount, description, reference_id)
    VALUES (p_user_id, 'hackathon_fee', -v_hackathon.entry_fee, 'Hackathon entry: ' || v_hackathon.title, v_hackathon.id);

    -- Recycle fee to treasury
    PERFORM public.record_recycling(v_hackathon.entry_fee);
  END IF;

  INSERT INTO public.hackathon_registrations (user_id, hackathon_id) VALUES (p_user_id, p_hackathon_id);
  UPDATE public.hackathons SET registered_count = registered_count + 1 WHERE id = p_hackathon_id;

  RETURN jsonb_build_object('success', true, 'hackathon', v_hackathon.title, 'fee_paid', v_hackathon.entry_fee);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
