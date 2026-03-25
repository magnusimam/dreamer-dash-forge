-- ============================================================
-- RAFFLES — Users pay DR to enter, admin draws a random winner
-- ============================================================

CREATE TABLE IF NOT EXISTS public.raffles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  entry_fee INTEGER NOT NULL DEFAULT 50,
  end_date TIMESTAMPTZ NOT NULL,
  max_entries INTEGER,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended')),
  winner_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.raffle_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  raffle_id UUID NOT NULL REFERENCES public.raffles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(raffle_id, user_id)
);

ALTER TABLE public.raffles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.raffle_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view raffles" ON public.raffles FOR SELECT USING (true);
CREATE POLICY "Admins can manage raffles" ON public.raffles FOR ALL USING (true);
CREATE POLICY "Anyone can view raffle entries" ON public.raffle_entries FOR SELECT USING (true);
CREATE POLICY "System can manage raffle entries" ON public.raffle_entries FOR ALL USING (true);

-- Enter a raffle (pay entry fee)
CREATE OR REPLACE FUNCTION public.enter_raffle(p_user_id UUID, p_raffle_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  v_raffle public.raffles%ROWTYPE;
  v_user public.users%ROWTYPE;
  v_already_entered BOOLEAN;
  v_entry_count INTEGER;
BEGIN
  SELECT * INTO v_raffle FROM public.raffles WHERE id = p_raffle_id AND is_active = TRUE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Raffle not found');
  END IF;

  IF v_raffle.status = 'ended' THEN
    RETURN jsonb_build_object('success', false, 'error', 'This raffle has ended');
  END IF;

  IF v_raffle.end_date < NOW() THEN
    RETURN jsonb_build_object('success', false, 'error', 'This raffle has expired');
  END IF;

  SELECT * INTO v_user FROM public.users WHERE id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.raffle_entries WHERE raffle_id = p_raffle_id AND user_id = p_user_id
  ) INTO v_already_entered;

  IF v_already_entered THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already entered this raffle');
  END IF;

  IF v_raffle.max_entries IS NOT NULL THEN
    SELECT COUNT(*) INTO v_entry_count FROM public.raffle_entries WHERE raffle_id = p_raffle_id;
    IF v_entry_count >= v_raffle.max_entries THEN
      RETURN jsonb_build_object('success', false, 'error', 'Raffle is full');
    END IF;
  END IF;

  IF v_user.balance < v_raffle.entry_fee THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance');
  END IF;

  -- Deduct entry fee
  UPDATE public.users SET balance = balance - v_raffle.entry_fee WHERE id = p_user_id;

  -- Record entry
  INSERT INTO public.raffle_entries (raffle_id, user_id) VALUES (p_raffle_id, p_user_id);

  -- Record transaction
  INSERT INTO public.transactions (user_id, type, amount, description, reference_id)
  VALUES (p_user_id, 'raffle_entry', -v_raffle.entry_fee, 'Raffle entry: ' || v_raffle.title, v_raffle.id);

  -- Recycle to treasury
  PERFORM public.record_recycling(v_raffle.entry_fee);

  RETURN jsonb_build_object('success', true, 'raffle', v_raffle.title, 'fee', v_raffle.entry_fee);
END;
$func$;

-- Draw a random winner
CREATE OR REPLACE FUNCTION public.draw_raffle_winner(p_admin_id UUID, p_raffle_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  v_admin public.users%ROWTYPE;
  v_raffle public.raffles%ROWTYPE;
  v_winner public.users%ROWTYPE;
  v_winner_entry public.raffle_entries%ROWTYPE;
  v_entry_count INTEGER;
  v_prize INTEGER;
BEGIN
  SELECT * INTO v_admin FROM public.users WHERE id = p_admin_id AND is_admin = TRUE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;

  SELECT * INTO v_raffle FROM public.raffles WHERE id = p_raffle_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Raffle not found');
  END IF;

  IF v_raffle.status = 'ended' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Winner already drawn');
  END IF;

  SELECT COUNT(*) INTO v_entry_count FROM public.raffle_entries WHERE raffle_id = p_raffle_id;
  IF v_entry_count = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'No entries yet');
  END IF;

  -- Pick random winner
  SELECT * INTO v_winner_entry FROM public.raffle_entries
  WHERE raffle_id = p_raffle_id
  ORDER BY random()
  LIMIT 1;

  SELECT * INTO v_winner FROM public.users WHERE id = v_winner_entry.user_id;

  -- Prize = 80% of total pool (20% stays in treasury as house cut)
  v_prize := FLOOR(v_entry_count * v_raffle.entry_fee * 0.80);

  -- Award winner
  UPDATE public.users SET balance = balance + v_prize WHERE id = v_winner.id;

  -- Record emission from treasury for the prize
  UPDATE public.token_supply SET
    treasury_balance = treasury_balance - v_prize,
    total_circulating = total_circulating + v_prize,
    updated_at = NOW()
  WHERE id = 1;

  -- Record transaction
  INSERT INTO public.transactions (user_id, type, amount, description, reference_id)
  VALUES (v_winner.id, 'raffle_win', v_prize, 'Raffle winner: ' || v_raffle.title, v_raffle.id);

  -- Update raffle
  UPDATE public.raffles SET status = 'ended', winner_id = v_winner.id WHERE id = p_raffle_id;

  -- Audit log
  INSERT INTO public.admin_audit_log (admin_id, action, target_user_id, amount, reason)
  VALUES (p_admin_id, 'raffle_draw', v_winner.id, v_prize,
    'Drew winner for: ' || v_raffle.title || ' (' || v_entry_count || ' entries)');

  RETURN jsonb_build_object('success', true, 'winner', v_winner.first_name,
    'winner_username', v_winner.username, 'prize', v_prize, 'entries', v_entry_count);
END;
$func$;

-- ============================================================
-- STREAK INSURANCE — Pay DR to protect check-in streak
-- ============================================================

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS streak_protected_until DATE;

-- Buy streak protection
CREATE OR REPLACE FUNCTION public.buy_streak_insurance(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  v_user public.users%ROWTYPE;
  v_cost INTEGER := 50;
BEGIN
  SELECT * INTO v_user FROM public.users WHERE id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  IF v_user.streak < 2 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Need at least 2-day streak to protect');
  END IF;

  IF v_user.streak_protected_until IS NOT NULL AND v_user.streak_protected_until >= CURRENT_DATE THEN
    RETURN jsonb_build_object('success', false, 'error', 'Streak already protected today');
  END IF;

  IF v_user.balance < v_cost THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance. Need ' || v_cost || ' DR');
  END IF;

  -- Deduct cost
  UPDATE public.users SET
    balance = balance - v_cost,
    streak_protected_until = CURRENT_DATE + INTERVAL '1 day'
  WHERE id = p_user_id;

  -- Record transaction
  INSERT INTO public.transactions (user_id, type, amount, description)
  VALUES (p_user_id, 'streak_insurance', -v_cost, 'Streak protection (Day ' || v_user.streak || ')');

  -- Recycle to treasury
  PERFORM public.record_recycling(v_cost);

  RETURN jsonb_build_object('success', true, 'cost', v_cost, 'protected_until',
    (CURRENT_DATE + INTERVAL '1 day')::TEXT, 'streak', v_user.streak);
END;
$func$;

-- Update daily checkin to respect streak insurance
CREATE OR REPLACE FUNCTION public.perform_daily_checkin(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  v_user public.users%ROWTYPE;
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

  -- Calculate streak (with insurance protection)
  IF v_user.last_check_in = CURRENT_DATE - INTERVAL '1 day' THEN
    -- Checked in yesterday — normal continuation
    v_new_streak := v_user.streak + 1;
  ELSIF v_user.streak_protected_until IS NOT NULL AND v_user.streak_protected_until >= CURRENT_DATE THEN
    -- Missed yesterday but streak is protected
    v_new_streak := v_user.streak + 1;
  ELSE
    v_new_streak := 1;
  END IF;

  IF v_new_streak % 7 = 0 THEN
    v_base_reward := v_base_reward + 50;
  END IF;

  v_multiplier := public.get_earning_multiplier(v_user.balance);
  v_reward := GREATEST(FLOOR(v_base_reward * v_multiplier)::INTEGER, 0);

  IF v_reward = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet cap reached. Spend some DR to earn more.');
  END IF;

  IF NOT public.can_emit(v_reward) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Daily distribution limit reached. Try again tomorrow.');
  END IF;

  INSERT INTO public.daily_checkins (user_id, reward) VALUES (p_user_id, v_reward);

  UPDATE public.users SET
    balance = balance + v_reward,
    total_earned = total_earned + v_reward,
    streak = v_new_streak,
    last_check_in = CURRENT_DATE,
    streak_protected_until = NULL
  WHERE id = p_user_id;

  INSERT INTO public.transactions (user_id, type, amount, description)
  VALUES (p_user_id, 'checkin', v_reward, 'Daily check-in (Day ' || v_new_streak || ')');

  PERFORM public.record_emission(v_reward);

  RETURN jsonb_build_object('success', true, 'reward', v_reward, 'streak', v_new_streak);
END;
$func$;
