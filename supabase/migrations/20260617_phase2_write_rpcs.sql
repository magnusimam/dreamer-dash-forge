-- ============================================================
-- PHASE 2B — DIRECT WRITES -> RPCs
-- ------------------------------------------------------------
-- Replaces every client-side direct table write (.from().insert/
-- update/delete) with a SECURITY DEFINER RPC that verifies identity
-- via the Phase 1 gateway. After this + the frontend rewire, the
-- companion lockdown migration revokes anon write privileges so the
-- only write path is these functions.
--
-- Self-service functions act only on the verified caller's own row.
-- Admin functions require the verified caller to be is_admin.
-- ============================================================

BEGIN;

-- Admin guard: returns the verified caller iff they are an admin.
CREATE OR REPLACE FUNCTION public.app_admin(p_init_data TEXT)
RETURNS public.users
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_u public.users;
BEGIN
  v_u := public.app_user(p_init_data);
  IF NOT COALESCE(v_u.is_admin, FALSE) THEN
    RAISE EXCEPTION 'unauthorized: admin only';
  END IF;
  RETURN v_u;
END; $$;
REVOKE ALL ON FUNCTION public.app_admin(TEXT) FROM PUBLIC, anon, authenticated;

-- ============================================================
-- SELF-SERVICE (caller's own row only)
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_my_birthday(p_init_data TEXT, p_birthday DATE)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  UPDATE public.users SET birthday = p_birthday WHERE id = (public.app_user(p_init_data)).id;
END; $$;
GRANT EXECUTE ON FUNCTION public.set_my_birthday(TEXT, DATE) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.save_my_bank_details(
  p_init_data TEXT, p_bank_name TEXT, p_account_number TEXT, p_account_name TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  UPDATE public.users
    SET bank_name = p_bank_name, account_number = p_account_number, account_name = p_account_name
    WHERE id = (public.app_user(p_init_data)).id;
END; $$;
GRANT EXECUTE ON FUNCTION public.save_my_bank_details(TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.touch_last_active(p_init_data TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  UPDATE public.users SET last_active = NOW() WHERE id = (public.app_user(p_init_data)).id;
END; $$;
GRANT EXECUTE ON FUNCTION public.touch_last_active(TEXT) TO anon, authenticated;

-- ============================================================
-- PROMO CODES (admin)
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_create_promo_code(
  p_init_data TEXT, p_code TEXT, p_reward INTEGER, p_description TEXT DEFAULT NULL)
RETURNS public.promo_codes LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_admin public.users; v_row public.promo_codes;
BEGIN
  v_admin := public.app_admin(p_init_data);
  INSERT INTO public.promo_codes (code, reward, description, created_by)
  VALUES (UPPER(TRIM(p_code)), p_reward, p_description, v_admin.id)
  RETURNING * INTO v_row;
  RETURN v_row;
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_create_promo_code(TEXT, TEXT, INTEGER, TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_generate_promo_codes(
  p_init_data TEXT, p_count INTEGER, p_reward INTEGER, p_description TEXT DEFAULT NULL)
RETURNS SETOF public.promo_codes LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_admin public.users;
BEGIN
  v_admin := public.app_admin(p_init_data);
  IF p_count IS NULL OR p_count < 1 OR p_count > 500 THEN
    RAISE EXCEPTION 'count must be between 1 and 500';
  END IF;
  RETURN QUERY
  INSERT INTO public.promo_codes (code, reward, description, created_by)
  SELECT 'BREATH-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT || clock_timestamp()::TEXT || g::TEXT) FROM 1 FOR 6)),
         p_reward, p_description, v_admin.id
  FROM generate_series(1, p_count) AS g
  RETURNING *;
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_generate_promo_codes(TEXT, INTEGER, INTEGER, TEXT) TO anon, authenticated;

-- ============================================================
-- REDEMPTION CATEGORIES (admin)
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_update_redemption_category(
  p_init_data TEXT, p_id TEXT, p_cost INTEGER DEFAULT NULL,
  p_description TEXT DEFAULT NULL, p_is_active BOOLEAN DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM public.app_admin(p_init_data);
  UPDATE public.redemption_categories SET
    cost        = COALESCE(p_cost, cost),
    description = COALESCE(p_description, description),
    is_active   = COALESCE(p_is_active, is_active),
    updated_at  = NOW()
  WHERE id = p_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_update_redemption_category(TEXT, TEXT, INTEGER, TEXT, BOOLEAN) TO anon, authenticated;

-- ============================================================
-- MISSIONS (admin)
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_create_mission(
  p_init_data TEXT, p_title TEXT, p_category TEXT, p_reward INTEGER,
  p_description TEXT DEFAULT NULL, p_unlock_fee INTEGER DEFAULT 0,
  p_completion_code TEXT DEFAULT NULL, p_expires_at TIMESTAMPTZ DEFAULT NULL)
RETURNS public.missions LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_row public.missions;
BEGIN
  PERFORM public.app_admin(p_init_data);
  INSERT INTO public.missions (title, category, reward, description, unlock_fee, completion_code, expires_at)
  VALUES (p_title, p_category, p_reward, p_description, COALESCE(p_unlock_fee, 0), p_completion_code, p_expires_at)
  RETURNING * INTO v_row;
  RETURN v_row;
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_create_mission(TEXT, TEXT, TEXT, INTEGER, TEXT, INTEGER, TEXT, TIMESTAMPTZ) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_update_mission(
  p_init_data TEXT, p_id UUID, p_title TEXT DEFAULT NULL, p_description TEXT DEFAULT NULL,
  p_reward INTEGER DEFAULT NULL, p_unlock_fee INTEGER DEFAULT NULL,
  p_completion_code TEXT DEFAULT NULL, p_expires_at TIMESTAMPTZ DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM public.app_admin(p_init_data);
  UPDATE public.missions SET
    title           = COALESCE(p_title, title),
    description      = COALESCE(p_description, description),
    reward          = COALESCE(p_reward, reward),
    unlock_fee      = COALESCE(p_unlock_fee, unlock_fee),
    completion_code = COALESCE(p_completion_code, completion_code),
    expires_at      = COALESCE(p_expires_at, expires_at)
  WHERE id = p_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_update_mission(TEXT, UUID, TEXT, TEXT, INTEGER, INTEGER, TEXT, TIMESTAMPTZ) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_mission_active(p_init_data TEXT, p_id UUID, p_is_active BOOLEAN)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM public.app_admin(p_init_data);
  UPDATE public.missions SET is_active = p_is_active WHERE id = p_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_set_mission_active(TEXT, UUID, BOOLEAN) TO anon, authenticated;

-- ============================================================
-- MENTORS (admin)
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_create_mentor(
  p_init_data TEXT, p_name TEXT, p_specialty TEXT, p_contact_info TEXT)
RETURNS public.mentors LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_row public.mentors;
BEGIN
  PERFORM public.app_admin(p_init_data);
  INSERT INTO public.mentors (name, specialty, contact_info)
  VALUES (p_name, COALESCE(p_specialty, ''), COALESCE(p_contact_info, ''))
  RETURNING * INTO v_row;
  RETURN v_row;
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_create_mentor(TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_update_mentor(
  p_init_data TEXT, p_id UUID, p_name TEXT DEFAULT NULL, p_specialty TEXT DEFAULT NULL,
  p_contact_info TEXT DEFAULT NULL, p_is_active BOOLEAN DEFAULT NULL)
RETURNS public.mentors LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_row public.mentors;
BEGIN
  PERFORM public.app_admin(p_init_data);
  UPDATE public.mentors SET
    name         = COALESCE(p_name, name),
    specialty    = COALESCE(p_specialty, specialty),
    contact_info = COALESCE(p_contact_info, contact_info),
    is_active    = COALESCE(p_is_active, is_active),
    updated_at   = NOW()
  WHERE id = p_id
  RETURNING * INTO v_row;
  RETURN v_row;
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_update_mentor(TEXT, UUID, TEXT, TEXT, TEXT, BOOLEAN) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_delete_mentor(p_init_data TEXT, p_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM public.app_admin(p_init_data);
  DELETE FROM public.mentors WHERE id = p_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_delete_mentor(TEXT, UUID) TO anon, authenticated;

-- ============================================================
-- ACTIVITIES (admin)
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_create_activity(
  p_init_data TEXT, p_title TEXT, p_category TEXT, p_date DATE, p_reward INTEGER, p_code TEXT,
  p_description TEXT DEFAULT NULL, p_max_participants INTEGER DEFAULT NULL,
  p_code_required BOOLEAN DEFAULT TRUE, p_proof_required BOOLEAN DEFAULT FALSE)
RETURNS public.activities LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_admin public.users; v_row public.activities;
BEGIN
  v_admin := public.app_admin(p_init_data);
  INSERT INTO public.activities (title, category, date, reward, code, description, max_participants, code_required, proof_required, created_by)
  VALUES (p_title, p_category, p_date, p_reward, p_code, p_description, p_max_participants,
          COALESCE(p_code_required, TRUE), COALESCE(p_proof_required, FALSE), v_admin.id)
  RETURNING * INTO v_row;
  RETURN v_row;
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_create_activity(TEXT, TEXT, TEXT, DATE, INTEGER, TEXT, TEXT, INTEGER, BOOLEAN, BOOLEAN) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_update_activity(
  p_init_data TEXT, p_id UUID, p_title TEXT DEFAULT NULL, p_description TEXT DEFAULT NULL,
  p_category TEXT DEFAULT NULL, p_date DATE DEFAULT NULL, p_reward INTEGER DEFAULT NULL,
  p_is_active BOOLEAN DEFAULT NULL)
RETURNS public.activities LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_row public.activities;
BEGIN
  PERFORM public.app_admin(p_init_data);
  UPDATE public.activities SET
    title       = COALESCE(p_title, title),
    description = COALESCE(p_description, description),
    category    = COALESCE(p_category, category),
    date        = COALESCE(p_date, date),
    reward      = COALESCE(p_reward, reward),
    is_active   = COALESCE(p_is_active, is_active)
  WHERE id = p_id
  RETURNING * INTO v_row;
  RETURN v_row;
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_update_activity(TEXT, UUID, TEXT, TEXT, TEXT, DATE, INTEGER, BOOLEAN) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_activity_active(p_init_data TEXT, p_id UUID, p_is_active BOOLEAN)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM public.app_admin(p_init_data);
  UPDATE public.activities SET is_active = p_is_active WHERE id = p_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_set_activity_active(TEXT, UUID, BOOLEAN) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_activity_status(p_init_data TEXT, p_id UUID, p_status TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM public.app_admin(p_init_data);
  UPDATE public.activities SET status = p_status WHERE id = p_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_set_activity_status(TEXT, UUID, TEXT) TO anon, authenticated;

-- ============================================================
-- HACKATHONS (admin)
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_create_hackathon(
  p_init_data TEXT, p_title TEXT, p_start_date DATE, p_end_date DATE,
  p_entry_fee INTEGER, p_prize_pool INTEGER, p_description TEXT DEFAULT NULL,
  p_max_teams INTEGER DEFAULT NULL, p_cover_image_url TEXT DEFAULT NULL)
RETURNS public.hackathons LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_admin public.users; v_row public.hackathons;
BEGIN
  v_admin := public.app_admin(p_init_data);
  INSERT INTO public.hackathons (title, start_date, end_date, entry_fee, prize_pool, description, max_teams, cover_image_url, created_by)
  VALUES (p_title, p_start_date, p_end_date, COALESCE(p_entry_fee, 0), COALESCE(p_prize_pool, 0),
          p_description, p_max_teams, p_cover_image_url, v_admin.id)
  RETURNING * INTO v_row;
  RETURN v_row;
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_create_hackathon(TEXT, TEXT, DATE, DATE, INTEGER, INTEGER, TEXT, INTEGER, TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_update_hackathon(
  p_init_data TEXT, p_id UUID, p_title TEXT DEFAULT NULL, p_description TEXT DEFAULT NULL,
  p_start_date DATE DEFAULT NULL, p_end_date DATE DEFAULT NULL, p_entry_fee INTEGER DEFAULT NULL,
  p_prize_pool INTEGER DEFAULT NULL, p_max_teams INTEGER DEFAULT NULL,
  p_status TEXT DEFAULT NULL, p_is_active BOOLEAN DEFAULT NULL)
RETURNS public.hackathons LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_row public.hackathons;
BEGIN
  PERFORM public.app_admin(p_init_data);
  UPDATE public.hackathons SET
    title       = COALESCE(p_title, title),
    description = COALESCE(p_description, description),
    start_date  = COALESCE(p_start_date, start_date),
    end_date    = COALESCE(p_end_date, end_date),
    entry_fee   = COALESCE(p_entry_fee, entry_fee),
    prize_pool  = COALESCE(p_prize_pool, prize_pool),
    max_teams   = COALESCE(p_max_teams, max_teams),
    status      = COALESCE(p_status, status),
    is_active   = COALESCE(p_is_active, is_active)
  WHERE id = p_id
  RETURNING * INTO v_row;
  RETURN v_row;
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_update_hackathon(TEXT, UUID, TEXT, TEXT, DATE, DATE, INTEGER, INTEGER, INTEGER, TEXT, BOOLEAN) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_delete_hackathon(p_init_data TEXT, p_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM public.app_admin(p_init_data);
  DELETE FROM public.hackathons WHERE id = p_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_delete_hackathon(TEXT, UUID) TO anon, authenticated;

-- ============================================================
-- RAFFLES (admin) — draw_raffle_winner already secured in Phase 2A
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_create_raffle(
  p_init_data TEXT, p_title TEXT, p_entry_fee INTEGER, p_end_date TIMESTAMPTZ,
  p_description TEXT DEFAULT NULL, p_max_entries INTEGER DEFAULT NULL)
RETURNS public.raffles LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_admin public.users; v_row public.raffles;
BEGIN
  v_admin := public.app_admin(p_init_data);
  INSERT INTO public.raffles (title, entry_fee, end_date, description, max_entries, created_by)
  VALUES (p_title, COALESCE(p_entry_fee, 50), p_end_date, p_description, p_max_entries, v_admin.id)
  RETURNING * INTO v_row;
  RETURN v_row;
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_create_raffle(TEXT, TEXT, INTEGER, TIMESTAMPTZ, TEXT, INTEGER) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_deactivate_raffle(p_init_data TEXT, p_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM public.app_admin(p_init_data);
  UPDATE public.raffles SET is_active = FALSE WHERE id = p_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_deactivate_raffle(TEXT, UUID) TO anon, authenticated;

-- ============================================================
-- STATES (admin) — delete_state already secured in Phase 2A
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_create_state(p_init_data TEXT, p_name TEXT)
RETURNS public.states LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_row public.states;
BEGIN
  PERFORM public.app_admin(p_init_data);
  INSERT INTO public.states (name) VALUES (p_name) RETURNING * INTO v_row;
  RETURN v_row;
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_create_state(TEXT, TEXT) TO anon, authenticated;

-- ============================================================
-- SPOTLIGHT — featured dreamer (any verified user; server picks)
-- and weekly MVP (admin). Returns only PUBLIC user columns.
-- ============================================================

CREATE OR REPLACE FUNCTION public.ensure_featured_dreamer(p_init_data TEXT, p_week_start DATE)
RETURNS TABLE (id UUID, first_name TEXT, last_name TEXT, username TEXT, photo_url TEXT,
               balance INTEGER, streak INTEGER, status TEXT, last_active TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_featured UUID;
BEGIN
  PERFORM public.app_user(p_init_data);  -- require a verified caller

  SELECT user_id INTO v_featured FROM public.featured_dreamers WHERE week_start = p_week_start;

  IF v_featured IS NULL THEN
    SELECT u.id INTO v_featured FROM public.users u WHERE u.is_admin = FALSE ORDER BY RANDOM() LIMIT 1;
    IF v_featured IS NOT NULL THEN
      INSERT INTO public.featured_dreamers (user_id, week_start)
      VALUES (v_featured, p_week_start)
      ON CONFLICT (week_start) DO NOTHING;
      -- re-read in case of a concurrent insert
      SELECT user_id INTO v_featured FROM public.featured_dreamers WHERE week_start = p_week_start;
    END IF;
  END IF;

  RETURN QUERY
  SELECT u.id, u.first_name, u.last_name, u.username, u.photo_url, u.balance, u.streak, u.status, u.last_active
  FROM public.users u WHERE u.id = v_featured;
END; $$;
GRANT EXECUTE ON FUNCTION public.ensure_featured_dreamer(TEXT, DATE) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_weekly_mvp(
  p_init_data TEXT, p_user_id UUID, p_week_start DATE, p_engagement_points INTEGER)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM public.app_admin(p_init_data);
  INSERT INTO public.weekly_mvps (user_id, week_start, engagement_points)
  VALUES (p_user_id, p_week_start, COALESCE(p_engagement_points, 0))
  ON CONFLICT (week_start) DO NOTHING;
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_set_weekly_mvp(TEXT, UUID, DATE, INTEGER) TO anon, authenticated;

COMMIT;
