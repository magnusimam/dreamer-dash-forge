-- ============================================================
-- INACTIVITY PENALTY: SHARE WITH ALL ACTIVE MEMBERS, WEIGHTED
-- ------------------------------------------------------------
-- Previously the DR taken from an inactive member went to only the top 3
-- active members in their state, ranked by ALL-TIME activity, so the same
-- three people won every time (e.g. Akwa Ibom's top 3 took ~17k DR).
--
-- Now it is split between EVERY member of the same state who checked in
-- within the last 7 days, weighted by their activity in those 7 days:
--   score = check-ins (max 7)
--         + activity logs (capped at 7, so logging can't be spammed)
--         + approved missions x 2
-- Each recipient gets floor(penalty * score / total_score); the DR left
-- over from rounding goes 1 DR at a time to the highest scores
-- (largest-remainder), so the full penalty is always paid out.
-- Every recipient has >= 1 check-in, so everyone active scores >= 1.
--
-- Penalty tiers (7d/14d/30d) and the treasury fallback are unchanged.
-- Only the internal _apply_inactivity_penalty(uuid) is replaced; the public
-- apply_inactivity_penalty(text) wrapper and its grants stay as they are.
-- ============================================================

CREATE OR REPLACE FUNCTION public._apply_inactivity_penalty(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_user RECORD;
  v_days_inactive INTEGER;
  v_penalty INTEGER := 0;
  v_warning TEXT := NULL;
  v_recipients INTEGER := 0;
BEGIN
  SELECT * INTO v_user FROM public.users WHERE id = p_user_id FOR UPDATE;
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

  IF v_days_inactive >= 30 THEN
    v_penalty := v_user.balance;
    v_warning := '30_day_warning';
  ELSIF v_days_inactive >= 14 THEN
    v_penalty := LEAST(v_user.balance, 500);
  ELSE
    v_penalty := LEAST(v_user.balance, 100);
  END IF;

  IF v_penalty <= 0 THEN
    UPDATE public.users SET last_penalty_date = CURRENT_DATE WHERE id = p_user_id;
    RETURN jsonb_build_object('penalty', 0, 'days_inactive', v_days_inactive);
  END IF;

  UPDATE public.users
     SET balance = balance - v_penalty, last_penalty_date = CURRENT_DATE
   WHERE id = p_user_id;

  INSERT INTO public.transactions (user_id, type, amount, description)
  VALUES (p_user_id, 'bonus', -v_penalty,
          'Inactivity penalty (' || v_days_inactive || ' days without check-in)');

  IF v_user.state_id IS NOT NULL THEN
    CREATE TEMP TABLE IF NOT EXISTS _inact_split (user_id uuid, amount integer) ON COMMIT DROP;
    TRUNCATE _inact_split;

    INSERT INTO _inact_split (user_id, amount)
    WITH active AS (
      SELECT u.id,
             LEAST(7, (SELECT COUNT(*) FROM public.daily_checkins c
                        WHERE c.user_id = u.id AND c.check_in_date >= CURRENT_DATE - 7))
           + LEAST(7, (SELECT COUNT(*) FROM public.activity_logs a
                        WHERE a.user_id = u.id AND a.logged_at >= CURRENT_DATE - 7))
           + 2 * (SELECT COUNT(*) FROM public.mission_completions m
                   WHERE m.user_id = u.id AND m.status = 'approved'
                     AND m.completed_at >= CURRENT_DATE - 7) AS raw_score
        FROM public.users u
       WHERE u.state_id = v_user.state_id
         AND u.id <> p_user_id
         AND u.last_check_in IS NOT NULL
         AND u.last_check_in >= CURRENT_DATE - 7
    ),
    scored AS (
      SELECT id, GREATEST(raw_score, 1)::numeric AS score FROM active
    ),
    base AS (
      SELECT id, score,
             floor(v_penalty * score / SUM(score) OVER ())::integer AS base_amt,
             (v_penalty * score / SUM(score) OVER ())
               - floor(v_penalty * score / SUM(score) OVER ()) AS frac
        FROM scored
    ),
    ranked AS (
      SELECT id, base_amt,
             ROW_NUMBER() OVER (ORDER BY frac DESC, score DESC, id) AS rn,
             v_penalty - SUM(base_amt) OVER () AS leftover
        FROM base
    )
    SELECT id, base_amt + CASE WHEN rn <= leftover THEN 1 ELSE 0 END
      FROM ranked;

    SELECT COUNT(*) INTO v_recipients FROM _inact_split;

    IF v_recipients > 0 THEN
      UPDATE public.users u
         SET balance = u.balance + s.amount
        FROM _inact_split s
       WHERE u.id = s.user_id AND s.amount > 0;

      INSERT INTO public.transactions (user_id, type, amount, description)
      SELECT user_id, 'bonus', amount, 'Inactivity reward from inactive member'
        FROM _inact_split WHERE amount > 0;

      RETURN jsonb_build_object('penalty', v_penalty, 'days_inactive', v_days_inactive,
                                'warning', v_warning,
                                'distributed_to', (SELECT COUNT(*) FROM _inact_split WHERE amount > 0));
    END IF;
  END IF;

  -- No state, or nobody active in the state: recycle to treasury
  PERFORM public.record_recycling(v_penalty);
  RETURN jsonb_build_object('penalty', v_penalty, 'days_inactive', v_days_inactive,
                            'warning', v_warning, 'distributed_to', 0);
END;
$function$;

REVOKE ALL ON FUNCTION public._apply_inactivity_penalty(uuid) FROM PUBLIC, anon, authenticated;
