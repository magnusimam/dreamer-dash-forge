-- Auto-pair all unpaired users weekly (called by admin when they open the app each Monday)
CREATE OR REPLACE FUNCTION public.auto_pair_dreamers()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  v_week_start DATE;
  v_week_end DATE;
  v_today DATE := CURRENT_DATE;
  v_dow INTEGER;
  v_unpaired_users UUID[];
  v_user1 UUID;
  v_user2 UUID;
  v_i INTEGER;
  v_count INTEGER;
  v_pairs_created INTEGER := 0;
BEGIN
  -- Week starts Monday
  v_dow := EXTRACT(DOW FROM v_today);
  v_week_start := v_today - ((v_dow + 6) % 7) * INTERVAL '1 day';
  v_week_end := v_week_start + INTERVAL '6 days';

  -- Don't run twice in same week
  IF EXISTS (SELECT 1 FROM public.dream_pairs WHERE week_start = v_week_start) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already paired this week');
  END IF;

  -- Mark last week's pairs as ended
  UPDATE public.dream_pairs SET status = 'ended' WHERE status = 'active' AND week_end < v_week_start;

  -- Get ALL non-admin users (random order) — intentionally mixes active with inactive
  -- so active users can help inactive ones catch up
  SELECT ARRAY_AGG(id ORDER BY random()) INTO v_unpaired_users
  FROM public.users
  WHERE is_admin = FALSE;

  IF v_unpaired_users IS NULL THEN
    RETURN jsonb_build_object('success', true, 'pairs_created', 0);
  END IF;

  v_count := array_length(v_unpaired_users, 1);
  v_i := 1;

  -- Pair them up two at a time
  WHILE v_i < v_count LOOP
    v_user1 := v_unpaired_users[v_i];
    v_user2 := v_unpaired_users[v_i + 1];
    INSERT INTO public.dream_pairs (user1_id, user2_id, week_start, week_end)
    VALUES (v_user1, v_user2, v_week_start, v_week_end);
    v_pairs_created := v_pairs_created + 1;
    v_i := v_i + 2;
  END LOOP;

  -- Odd user out goes to queue
  IF v_count % 2 = 1 THEN
    INSERT INTO public.pair_queue (user_id) VALUES (v_unpaired_users[v_count])
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  -- Clear old queue entries for paired users
  DELETE FROM public.pair_queue WHERE user_id = ANY(v_unpaired_users[1:v_count-1]);

  RETURN jsonb_build_object('success', true, 'pairs_created', v_pairs_created);
END;
$func$;

-- Join the pair queue (or pair immediately if someone's waiting)
CREATE OR REPLACE FUNCTION public.join_pair_queue(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  v_waiting_user UUID;
  v_today DATE := CURRENT_DATE;
  v_dow INTEGER;
  v_week_start DATE;
  v_week_end DATE;
  v_has_pair BOOLEAN;
BEGIN
  -- Check if already paired this week
  v_dow := EXTRACT(DOW FROM v_today);
  v_week_start := v_today - ((v_dow + 6) % 7) * INTERVAL '1 day';
  v_week_end := v_week_start + INTERVAL '6 days';

  SELECT EXISTS(
    SELECT 1 FROM public.dream_pairs
    WHERE (user1_id = p_user_id OR user2_id = p_user_id)
      AND status = 'active'
      AND week_start = v_week_start
  ) INTO v_has_pair;

  IF v_has_pair THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already paired this week');
  END IF;

  -- Check if someone's waiting in queue (not this user)
  SELECT user_id INTO v_waiting_user FROM public.pair_queue
  WHERE user_id != p_user_id
  ORDER BY joined_at ASC
  LIMIT 1;

  IF v_waiting_user IS NOT NULL THEN
    -- Pair them immediately
    INSERT INTO public.dream_pairs (user1_id, user2_id, week_start, week_end)
    VALUES (p_user_id, v_waiting_user, v_week_start, v_week_end);
    DELETE FROM public.pair_queue WHERE user_id = v_waiting_user;
    DELETE FROM public.pair_queue WHERE user_id = p_user_id;
    RETURN jsonb_build_object('success', true, 'paired', true, 'partner_id', v_waiting_user);
  END IF;

  -- Otherwise join the queue
  INSERT INTO public.pair_queue (user_id) VALUES (p_user_id) ON CONFLICT (user_id) DO NOTHING;
  RETURN jsonb_build_object('success', true, 'paired', false, 'queued', true);
END;
$func$;

-- Rate partner at end of week
CREATE OR REPLACE FUNCTION public.rate_pair(p_user_id UUID, p_pair_id UUID, p_rating INTEGER, p_comment TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  v_pair RECORD;
  v_partner_id UUID;
  v_reward INTEGER;
BEGIN
  IF p_rating < 1 OR p_rating > 5 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Rating must be 1-5');
  END IF;

  SELECT * INTO v_pair FROM public.dream_pairs WHERE id = p_pair_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pair not found');
  END IF;

  IF v_pair.user1_id = p_user_id THEN
    IF v_pair.rating_from_1 IS NOT NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Already rated');
    END IF;
    UPDATE public.dream_pairs SET rating_from_1 = p_rating, comment_from_1 = p_comment WHERE id = p_pair_id;
    v_partner_id := v_pair.user2_id;
  ELSIF v_pair.user2_id = p_user_id THEN
    IF v_pair.rating_from_2 IS NOT NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Already rated');
    END IF;
    UPDATE public.dream_pairs SET rating_from_2 = p_rating, comment_from_2 = p_comment WHERE id = p_pair_id;
    v_partner_id := v_pair.user1_id;
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Not part of this pair');
  END IF;

  -- Award bonus DR to partner based on rating
  v_reward := p_rating * 10; -- 1 star = 10 DR, 5 stars = 50 DR
  UPDATE public.users SET balance = balance + v_reward, total_earned = total_earned + v_reward WHERE id = v_partner_id;
  INSERT INTO public.transactions (user_id, type, amount, description)
  VALUES (v_partner_id, 'bonus', v_reward, 'Pair rating reward: ' || p_rating || ' stars');

  PERFORM public.record_emission(v_reward);

  RETURN jsonb_build_object('success', true, 'reward', v_reward, 'partner_id', v_partner_id);
END;
$func$;

-- Keep the same pair for another week (100 DR each)
CREATE OR REPLACE FUNCTION public.keep_pair(p_user_id UUID, p_pair_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  v_pair RECORD;
  v_user1 RECORD;
  v_user2 RECORD;
  v_cost INTEGER := 100;
  v_today DATE := CURRENT_DATE;
  v_dow INTEGER;
  v_next_week_start DATE;
  v_next_week_end DATE;
BEGIN
  SELECT * INTO v_pair FROM public.dream_pairs WHERE id = p_pair_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pair not found');
  END IF;

  IF v_pair.user1_id != p_user_id AND v_pair.user2_id != p_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not part of this pair');
  END IF;

  SELECT * INTO v_user1 FROM public.users WHERE id = v_pair.user1_id;
  SELECT * INTO v_user2 FROM public.users WHERE id = v_pair.user2_id;

  IF v_user1.balance < v_cost OR v_user2.balance < v_cost THEN
    RETURN jsonb_build_object('success', false, 'error', 'Both pairs need at least ' || v_cost || ' DR');
  END IF;

  -- Calculate next week
  v_dow := EXTRACT(DOW FROM v_today);
  v_next_week_start := v_today - ((v_dow + 6) % 7) * INTERVAL '1 day' + INTERVAL '7 days';
  v_next_week_end := v_next_week_start + INTERVAL '6 days';

  -- Check if already extended
  IF EXISTS(SELECT 1 FROM public.dream_pairs WHERE user1_id = v_pair.user1_id AND user2_id = v_pair.user2_id AND week_start = v_next_week_start) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already extended for next week');
  END IF;

  -- Deduct from both users
  UPDATE public.users SET balance = balance - v_cost WHERE id IN (v_pair.user1_id, v_pair.user2_id);

  INSERT INTO public.transactions (user_id, type, amount, description) VALUES
    (v_pair.user1_id, 'bonus', -v_cost, 'Dream Pair extension fee'),
    (v_pair.user2_id, 'bonus', -v_cost, 'Dream Pair extension fee');

  PERFORM public.record_recycling(v_cost * 2);

  -- Create next week's pair
  INSERT INTO public.dream_pairs (user1_id, user2_id, week_start, week_end)
  VALUES (v_pair.user1_id, v_pair.user2_id, v_next_week_start, v_next_week_end);

  RETURN jsonb_build_object('success', true);
END;
$func$;

-- Check in FOR your pair partner (once per pair)
CREATE OR REPLACE FUNCTION public.checkin_for_pair(p_user_id UUID, p_pair_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  v_pair RECORD;
  v_partner_id UUID;
  v_is_user1 BOOLEAN;
  v_already_checked_in BOOLEAN;
  v_new_streak INTEGER;
  v_partner RECORD;
  v_reward INTEGER := 25;
  v_multiplier NUMERIC;
BEGIN
  SELECT * INTO v_pair FROM public.dream_pairs WHERE id = p_pair_id AND status = 'active';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Active pair not found');
  END IF;

  IF v_pair.user1_id = p_user_id THEN
    v_is_user1 := TRUE;
    v_partner_id := v_pair.user2_id;
    IF v_pair.user1_checked_for_2 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Already checked in for your partner this week');
    END IF;
  ELSIF v_pair.user2_id = p_user_id THEN
    v_is_user1 := FALSE;
    v_partner_id := v_pair.user1_id;
    IF v_pair.user2_checked_for_1 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Already checked in for your partner this week');
    END IF;
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Not part of this pair');
  END IF;

  SELECT * INTO v_partner FROM public.users WHERE id = v_partner_id;

  -- Check if partner already checked in today
  SELECT EXISTS(SELECT 1 FROM public.daily_checkins WHERE user_id = v_partner_id AND check_in_date = CURRENT_DATE) INTO v_already_checked_in;
  IF v_already_checked_in THEN
    RETURN jsonb_build_object('success', false, 'error', 'Your partner already checked in today');
  END IF;

  -- Calculate streak
  IF v_partner.last_check_in = CURRENT_DATE - INTERVAL '1 day' THEN
    v_new_streak := v_partner.streak + 1;
  ELSIF v_partner.streak_protected_until IS NOT NULL AND v_partner.streak_protected_until >= CURRENT_DATE THEN
    v_new_streak := v_partner.streak + 1;
  ELSE
    v_new_streak := 1;
  END IF;

  IF v_new_streak % 7 = 0 THEN v_reward := v_reward + 50; END IF;
  v_multiplier := public.get_earning_multiplier(v_partner.balance);
  v_reward := GREATEST(FLOOR(v_reward * v_multiplier)::INTEGER, 0);

  IF v_reward = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Partner wallet cap reached');
  END IF;

  INSERT INTO public.daily_checkins (user_id, reward) VALUES (v_partner_id, v_reward);
  UPDATE public.users SET
    balance = balance + v_reward,
    total_earned = total_earned + v_reward,
    streak = v_new_streak,
    last_check_in = CURRENT_DATE,
    streak_protected_until = NULL
  WHERE id = v_partner_id;

  INSERT INTO public.transactions (user_id, type, amount, description)
  VALUES (v_partner_id, 'checkin', v_reward, 'Check-in by Dream Pair partner');

  -- Mark pair
  IF v_is_user1 THEN
    UPDATE public.dream_pairs SET user1_checked_for_2 = TRUE WHERE id = p_pair_id;
  ELSE
    UPDATE public.dream_pairs SET user2_checked_for_1 = TRUE WHERE id = p_pair_id;
  END IF;

  PERFORM public.record_emission(v_reward);

  RETURN jsonb_build_object('success', true, 'reward', v_reward, 'partner_id', v_partner_id, 'partner_name', v_partner.first_name, 'partner_telegram_id', v_partner.telegram_id);
END;
$func$;
