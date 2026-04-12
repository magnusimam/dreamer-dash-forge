-- Updated inactivity penalty: deducted DR goes to top 3 active dreamers in same state
CREATE OR REPLACE FUNCTION public.apply_inactivity_penalty(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  v_user RECORD;
  v_days_inactive INTEGER;
  v_penalty INTEGER := 0;
  v_warning TEXT := NULL;
  v_top_user RECORD;
  v_share INTEGER;
  v_remainder INTEGER;
  v_distributed INTEGER := 0;
  v_top3_count INTEGER := 0;
BEGIN
  SELECT * INTO v_user FROM public.users WHERE id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('penalty', 0);
  END IF;

  IF v_user.last_check_in IS NULL THEN
    v_days_inactive := CURRENT_DATE - v_user.created_at::DATE;
  ELSE
    v_days_inactive := CURRENT_DATE - v_user.last_check_in;
  END IF;

  IF v_days_inactive < 7 THEN
    RETURN jsonb_build_object('penalty', 0);
  END IF;

  IF v_user.last_penalty_date IS NOT NULL AND v_user.last_penalty_date = CURRENT_DATE THEN
    RETURN jsonb_build_object('penalty', 0);
  END IF;

  -- Determine penalty
  IF v_days_inactive >= 30 THEN
    v_penalty := v_user.balance;
    v_warning := '30_day_warning';
  ELSIF v_days_inactive >= 14 THEN
    v_penalty := LEAST(v_user.balance, 500);
  ELSIF v_days_inactive >= 7 THEN
    v_penalty := LEAST(v_user.balance, 100);
  END IF;

  IF v_penalty <= 0 THEN
    UPDATE public.users SET last_penalty_date = CURRENT_DATE WHERE id = p_user_id;
    RETURN jsonb_build_object('penalty', 0, 'days_inactive', v_days_inactive);
  END IF;

  -- Deduct from inactive user
  UPDATE public.users SET balance = balance - v_penalty, last_penalty_date = CURRENT_DATE WHERE id = p_user_id;

  INSERT INTO public.transactions (user_id, type, amount, description)
  VALUES (p_user_id, 'bonus', -v_penalty, 'Inactivity penalty (' || v_days_inactive || ' days without check-in)');

  -- Distribute to top 3 active users in same state
  IF v_user.state_id IS NOT NULL THEN
    FOR v_top_user IN
      SELECT u.id, u.first_name,
        (SELECT COUNT(*) FROM public.activity_logs WHERE user_id = u.id) +
        (SELECT COUNT(*) FROM public.mission_completions WHERE user_id = u.id AND status = 'approved') * 2 +
        (SELECT COUNT(*) FROM public.daily_checkins WHERE user_id = u.id) AS activity_score
      FROM public.users u
      WHERE u.state_id = v_user.state_id
        AND u.id != p_user_id
        AND u.last_check_in IS NOT NULL
        AND u.last_check_in >= CURRENT_DATE - INTERVAL '7 days'
      ORDER BY activity_score DESC
      LIMIT 3
    LOOP
      v_top3_count := v_top3_count + 1;
    END LOOP;

    IF v_top3_count > 0 THEN
      v_share := v_penalty / v_top3_count;
      v_remainder := v_penalty - (v_share * v_top3_count);
      v_distributed := 0;

      FOR v_top_user IN
        SELECT u.id, u.first_name,
          (SELECT COUNT(*) FROM public.activity_logs WHERE user_id = u.id) +
          (SELECT COUNT(*) FROM public.mission_completions WHERE user_id = u.id AND status = 'approved') * 2 +
          (SELECT COUNT(*) FROM public.daily_checkins WHERE user_id = u.id) AS activity_score
        FROM public.users u
        WHERE u.state_id = v_user.state_id
          AND u.id != p_user_id
          AND u.last_check_in IS NOT NULL
          AND u.last_check_in >= CURRENT_DATE - INTERVAL '7 days'
        ORDER BY activity_score DESC
        LIMIT 3
      LOOP
        v_distributed := v_distributed + 1;
        UPDATE public.users SET balance = balance + v_share + (CASE WHEN v_distributed = 1 THEN v_remainder ELSE 0 END) WHERE id = v_top_user.id;
        INSERT INTO public.transactions (user_id, type, amount, description)
        VALUES (v_top_user.id, 'bonus', v_share + (CASE WHEN v_distributed = 1 THEN v_remainder ELSE 0 END),
          'Inactivity reward from inactive member');
      END LOOP;

      -- Update circulating supply (DR stays in circulation, just moved between users)
      RETURN jsonb_build_object('penalty', v_penalty, 'days_inactive', v_days_inactive, 'warning', v_warning, 'distributed_to', v_top3_count);
    END IF;
  END IF;

  -- No state or no active users in state — recycle to treasury
  PERFORM public.record_recycling(v_penalty);
  RETURN jsonb_build_object('penalty', v_penalty, 'days_inactive', v_days_inactive, 'warning', v_warning, 'distributed_to', 0);
END;
$func$;
