-- Inactivity penalty system
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_penalty_date DATE;

-- Apply inactivity penalty based on last check-in
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
BEGIN
  SELECT * INTO v_user FROM public.users WHERE id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('penalty', 0);
  END IF;

  -- No check-in ever = treat as inactive from account creation
  IF v_user.last_check_in IS NULL THEN
    v_days_inactive := CURRENT_DATE - v_user.created_at::DATE;
  ELSE
    v_days_inactive := CURRENT_DATE - v_user.last_check_in;
  END IF;

  -- Skip if not inactive enough
  IF v_days_inactive < 7 THEN
    RETURN jsonb_build_object('penalty', 0);
  END IF;

  -- Skip if penalty already applied today
  IF v_user.last_penalty_date IS NOT NULL AND v_user.last_penalty_date = CURRENT_DATE THEN
    RETURN jsonb_build_object('penalty', 0);
  END IF;

  -- Determine penalty
  IF v_days_inactive >= 30 THEN
    v_penalty := LEAST(v_user.balance, 200);
    v_warning := '30_day_warning';
  ELSIF v_days_inactive >= 10 THEN
    v_penalty := LEAST(v_user.balance, 200);
  ELSIF v_days_inactive >= 7 THEN
    v_penalty := LEAST(v_user.balance, 50);
  END IF;

  -- Apply penalty
  IF v_penalty > 0 THEN
    UPDATE public.users SET
      balance = balance - v_penalty,
      last_penalty_date = CURRENT_DATE
    WHERE id = p_user_id;

    INSERT INTO public.transactions (user_id, type, amount, description)
    VALUES (p_user_id, 'bonus', -v_penalty,
      'Inactivity penalty (' || v_days_inactive || ' days without check-in)');

    PERFORM public.record_recycling(v_penalty);
  ELSE
    UPDATE public.users SET last_penalty_date = CURRENT_DATE WHERE id = p_user_id;
  END IF;

  RETURN jsonb_build_object(
    'penalty', v_penalty,
    'days_inactive', v_days_inactive,
    'warning', v_warning
  );
END;
$func$;
