-- Add winner tracking to hackathons
ALTER TABLE public.hackathons ADD COLUMN IF NOT EXISTS winner_id UUID REFERENCES public.users(id) ON DELETE SET NULL;

-- Admin function to declare a hackathon winner
CREATE OR REPLACE FUNCTION public.set_hackathon_winner(p_admin_id UUID, p_hackathon_id UUID, p_winner_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  v_admin RECORD;
  v_hackathon RECORD;
  v_winner RECORD;
  v_is_registered BOOLEAN;
BEGIN
  SELECT * INTO v_admin FROM public.users WHERE id = p_admin_id AND is_admin = TRUE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;

  SELECT * INTO v_hackathon FROM public.hackathons WHERE id = p_hackathon_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Hackathon not found');
  END IF;

  -- Verify winner is registered for this hackathon
  SELECT EXISTS(SELECT 1 FROM public.hackathon_registrations WHERE user_id = p_winner_id AND hackathon_id = p_hackathon_id) INTO v_is_registered;
  IF NOT v_is_registered THEN
    RETURN jsonb_build_object('success', false, 'error', 'Winner must be registered for this hackathon');
  END IF;

  SELECT * INTO v_winner FROM public.users WHERE id = p_winner_id;

  -- Award prize pool to winner
  IF v_hackathon.prize_pool > 0 THEN
    UPDATE public.users SET balance = balance + v_hackathon.prize_pool, total_earned = total_earned + v_hackathon.prize_pool WHERE id = p_winner_id;
    INSERT INTO public.transactions (user_id, type, amount, description, reference_id)
    VALUES (p_winner_id, 'hackathon_prize', v_hackathon.prize_pool, 'Hackathon winner: ' || v_hackathon.title, v_hackathon.id);

    -- Deduct from hackathon pool
    UPDATE public.token_supply SET hackathon_pool = GREATEST(hackathon_pool - v_hackathon.prize_pool, 0), total_circulating = total_circulating + v_hackathon.prize_pool WHERE id = 1;
  END IF;

  -- Set winner and mark as completed
  UPDATE public.hackathons SET winner_id = p_winner_id, status = 'completed' WHERE id = p_hackathon_id;

  RETURN jsonb_build_object('success', true, 'winner', v_winner.first_name, 'winner_username', v_winner.username, 'winner_telegram_id', v_winner.telegram_id, 'prize', v_hackathon.prize_pool);
END;
$func$;

-- Update community stats to include hackathon wins (10 XP each)
CREATE OR REPLACE FUNCTION public.get_community_stats()
RETURNS TABLE (
  user_id UUID,
  first_name TEXT,
  last_name TEXT,
  username TEXT,
  photo_url TEXT,
  balance INTEGER,
  total_earned INTEGER,
  streak INTEGER,
  last_active TIMESTAMPTZ,
  missions BIGINT,
  raffles BIGINT,
  raffle_wins BIGINT,
  activities BIGINT,
  promos BIGINT,
  checkins BIGINT,
  transfers BIGINT,
  redeems BIGINT,
  hackathons BIGINT,
  hackathon_wins BIGINT,
  engagement BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
BEGIN
  RETURN QUERY
  SELECT
    u.id AS user_id,
    u.first_name,
    u.last_name,
    u.username,
    u.photo_url,
    u.balance,
    u.total_earned,
    u.streak,
    u.last_active,
    COALESCE(mc.cnt, 0) AS missions,
    COALESCE(re.cnt, 0) AS raffles,
    COALESCE(rw.cnt, 0) AS raffle_wins,
    COALESCE(al.cnt, 0) AS activities,
    COALESCE(pc.cnt, 0) AS promos,
    COALESCE(dc.cnt, 0) AS checkins,
    COALESCE(tr.cnt, 0) AS transfers,
    COALESCE(rd.cnt, 0) AS redeems,
    COALESCE(hr.cnt, 0) AS hackathons,
    COALESCE(hw.cnt, 0) AS hackathon_wins,
    FLOOR(
      COALESCE(mc.cnt, 0) * 2
      + COALESCE(al.cnt, 0) * 1
      + COALESCE(re.cnt, 0) * 0.5
      + COALESCE(rw.cnt, 0) * 3
      + COALESCE(pc.cnt, 0) * 1
      + COALESCE(dc.cnt, 0) * 0.2
      + COALESCE(tr.cnt, 0) * 0.5
      + COALESCE(hr.cnt, 0) * 2
      + COALESCE(hw.cnt, 0) * 10
    )::BIGINT AS engagement
  FROM public.users u
  LEFT JOIN (SELECT mc2.user_id, COUNT(*)::BIGINT AS cnt FROM public.mission_completions mc2 WHERE mc2.status = 'approved' GROUP BY mc2.user_id) mc ON mc.user_id = u.id
  LEFT JOIN (SELECT re2.user_id, COUNT(*)::BIGINT AS cnt FROM public.raffle_entries re2 GROUP BY re2.user_id) re ON re.user_id = u.id
  LEFT JOIN (SELECT rw2.winner_id, COUNT(*)::BIGINT AS cnt FROM public.raffles rw2 WHERE rw2.winner_id IS NOT NULL GROUP BY rw2.winner_id) rw ON rw.winner_id = u.id
  LEFT JOIN (SELECT al2.user_id, COUNT(*)::BIGINT AS cnt FROM public.activity_logs al2 GROUP BY al2.user_id) al ON al.user_id = u.id
  LEFT JOIN (SELECT pc2.claimed_by, COUNT(*)::BIGINT AS cnt FROM public.promo_codes pc2 WHERE pc2.is_used = TRUE AND pc2.claimed_by IS NOT NULL GROUP BY pc2.claimed_by) pc ON pc.claimed_by = u.id
  LEFT JOIN (SELECT dc2.user_id, COUNT(*)::BIGINT AS cnt FROM public.daily_checkins dc2 GROUP BY dc2.user_id) dc ON dc.user_id = u.id
  LEFT JOIN (SELECT tr2.user_id, COUNT(*)::BIGINT AS cnt FROM public.transactions tr2 WHERE tr2.type = 'transfer_out' GROUP BY tr2.user_id) tr ON tr.user_id = u.id
  LEFT JOIN (SELECT rd2.user_id, COUNT(*)::BIGINT AS cnt FROM public.redemption_requests rd2 GROUP BY rd2.user_id) rd ON rd.user_id = u.id
  LEFT JOIN (SELECT hr2.user_id, COUNT(*)::BIGINT AS cnt FROM public.hackathon_registrations hr2 GROUP BY hr2.user_id) hr ON hr.user_id = u.id
  LEFT JOIN (SELECT hw2.winner_id, COUNT(*)::BIGINT AS cnt FROM public.hackathons hw2 WHERE hw2.winner_id IS NOT NULL GROUP BY hw2.winner_id) hw ON hw.winner_id = u.id
  ORDER BY engagement DESC;
END;
$func$;

-- Update claim_level_reward to include hackathon wins
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
  v_thresholds INTEGER[] := ARRAY[0, 30, 80, 180, 350, 600, 1000, 1600, 2500, 3800, 5500, 7700, 10500, 14000, 18500, 24000, 30500, 38500, 48000, 59000, 72000, 87000, 104500, 125000, 148500, 175500, 206000, 241000, 281000, 326500, 378000, 436000, 501000, 573500, 654500, 744500, 844000, 954000, 1075000, 1208000, 1354000, 1514000, 1689000, 1880000, 2088000, 2314000, 2559000, 2824000, 3110000, 3418000];
BEGIN
  IF p_level < 1 OR p_level > 50 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid level');
  END IF;

  SELECT * INTO v_user FROM public.users WHERE id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  SELECT EXISTS(SELECT 1 FROM public.level_rewards_claimed WHERE user_id = p_user_id AND level = p_level) INTO v_already_claimed;
  IF v_already_claimed THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already claimed this level');
  END IF;

  SELECT FLOOR(
    (SELECT COALESCE(COUNT(*), 0) FROM public.mission_completions WHERE user_id = p_user_id AND status = 'approved') * 2
    + (SELECT COALESCE(COUNT(*), 0) FROM public.activity_logs WHERE user_id = p_user_id) * 1
    + (SELECT COALESCE(COUNT(*), 0) FROM public.raffle_entries WHERE user_id = p_user_id) * 0.5
    + (SELECT COALESCE(COUNT(*), 0) FROM public.raffles WHERE winner_id = p_user_id) * 3
    + (SELECT COALESCE(COUNT(*), 0) FROM public.promo_codes WHERE claimed_by = p_user_id) * 1
    + (SELECT COALESCE(COUNT(*), 0) FROM public.daily_checkins WHERE user_id = p_user_id) * 0.2
    + (SELECT COALESCE(COUNT(*), 0) FROM public.transactions WHERE user_id = p_user_id AND type = 'transfer_out') * 0.5
    + (SELECT COALESCE(COUNT(*), 0) FROM public.hackathon_registrations WHERE user_id = p_user_id) * 2
    + (SELECT COALESCE(COUNT(*), 0) FROM public.hackathons WHERE winner_id = p_user_id) * 10
  )::INTEGER INTO v_engagement;

  v_required_xp := v_thresholds[p_level];
  IF v_engagement < v_required_xp THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not enough XP for level ' || p_level || '. You have ' || v_engagement || ', need ' || v_required_xp);
  END IF;

  v_reward := LEAST(200 * POWER(3, p_level - 1)::INTEGER, 10000);

  IF (SELECT treasury_balance FROM public.token_supply WHERE id = 1) < v_reward THEN
    RETURN jsonb_build_object('success', false, 'error', 'Treasury empty, try later');
  END IF;

  INSERT INTO public.level_rewards_claimed (user_id, level, reward) VALUES (p_user_id, p_level, v_reward);
  UPDATE public.users SET balance = balance + v_reward, total_earned = total_earned + v_reward WHERE id = p_user_id;
  INSERT INTO public.transactions (user_id, type, amount, description)
  VALUES (p_user_id, 'bonus', v_reward, 'Level ' || p_level || ' reward');
  PERFORM public.record_emission(v_reward);

  RETURN jsonb_build_object('success', true, 'level', p_level, 'reward', v_reward);
END;
$func$;
