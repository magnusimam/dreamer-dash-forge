-- ============================================================
-- PHASE 2 — RPC AUTH CONVERSION
-- ------------------------------------------------------------
-- Wraps every remaining privileged RPC so identity comes from the
-- verified Telegram initData (via the Phase 1 gateway) instead of a
-- client-supplied id. Strategy per function:
--   1. rename the original (logic-preserving) to public._<name>
--   2. revoke anon/authenticated EXECUTE on the internal _<name>
--   3. create a thin wrapper public.<name>(p_init_data, <real args>)
--      that resolves the caller with app_user()/admin check, then
--      calls the internal function with the VERIFIED id.
--
-- Verified by audit: none of these functions call each other and no
-- trigger/cron/edge invokes them, so renaming is safe.
--
-- Atomic: wrapped in a transaction (Postgres DDL is transactional).
-- ============================================================

BEGIN;

-- ============================================================
-- USER ACTIONS — caller = app_user(initData)
-- ============================================================

-- perform_daily_checkin --------------------------------------
ALTER FUNCTION public.perform_daily_checkin(UUID) RENAME TO _perform_daily_checkin;
REVOKE ALL ON FUNCTION public._perform_daily_checkin(UUID) FROM PUBLIC, anon, authenticated;
CREATE FUNCTION public.perform_daily_checkin(p_init_data TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RETURN public._perform_daily_checkin((public.app_user(p_init_data)).id);
END; $$;
GRANT EXECUTE ON FUNCTION public.perform_daily_checkin(TEXT) TO anon, authenticated;

-- log_activity (drop dead 2-arg overload; wrap the 3-arg proof version)
DROP FUNCTION IF EXISTS public.log_activity(UUID, TEXT);
ALTER FUNCTION public.log_activity(UUID, TEXT, TEXT) RENAME TO _log_activity;
REVOKE ALL ON FUNCTION public._log_activity(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
CREATE FUNCTION public.log_activity(p_init_data TEXT, p_code TEXT, p_proof_url TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RETURN public._log_activity((public.app_user(p_init_data)).id, p_code, p_proof_url);
END; $$;
GRANT EXECUTE ON FUNCTION public.log_activity(TEXT, TEXT, TEXT) TO anon, authenticated;

-- complete_mission -------------------------------------------
ALTER FUNCTION public.complete_mission(UUID, UUID, TEXT, TEXT) RENAME TO _complete_mission;
REVOKE ALL ON FUNCTION public._complete_mission(UUID, UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
CREATE FUNCTION public.complete_mission(p_init_data TEXT, p_mission_id UUID, p_code TEXT DEFAULT NULL, p_note TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RETURN public._complete_mission((public.app_user(p_init_data)).id, p_mission_id, p_code, p_note);
END; $$;
GRANT EXECUTE ON FUNCTION public.complete_mission(TEXT, UUID, TEXT, TEXT) TO anon, authenticated;

-- unlock_mission ---------------------------------------------
ALTER FUNCTION public.unlock_mission(UUID, UUID) RENAME TO _unlock_mission;
REVOKE ALL ON FUNCTION public._unlock_mission(UUID, UUID) FROM PUBLIC, anon, authenticated;
CREATE FUNCTION public.unlock_mission(p_init_data TEXT, p_mission_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RETURN public._unlock_mission((public.app_user(p_init_data)).id, p_mission_id);
END; $$;
GRANT EXECUTE ON FUNCTION public.unlock_mission(TEXT, UUID) TO anon, authenticated;

-- submit_mission_proof ---------------------------------------
ALTER FUNCTION public.submit_mission_proof(UUID, UUID, TEXT) RENAME TO _submit_mission_proof;
REVOKE ALL ON FUNCTION public._submit_mission_proof(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
CREATE FUNCTION public.submit_mission_proof(p_init_data TEXT, p_mission_id UUID, p_proof_url TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RETURN public._submit_mission_proof((public.app_user(p_init_data)).id, p_mission_id, p_proof_url);
END; $$;
GRANT EXECUTE ON FUNCTION public.submit_mission_proof(TEXT, UUID, TEXT) TO anon, authenticated;

-- submit_redemption ------------------------------------------
ALTER FUNCTION public.submit_redemption(UUID, TEXT, INTEGER, JSONB) RENAME TO _submit_redemption;
REVOKE ALL ON FUNCTION public._submit_redemption(UUID, TEXT, INTEGER, JSONB) FROM PUBLIC, anon, authenticated;
CREATE FUNCTION public.submit_redemption(p_init_data TEXT, p_category TEXT, p_amount INTEGER, p_details JSONB)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RETURN public._submit_redemption((public.app_user(p_init_data)).id, p_category, p_amount, p_details);
END; $$;
GRANT EXECUTE ON FUNCTION public.submit_redemption(TEXT, TEXT, INTEGER, JSONB) TO anon, authenticated;

-- get_user_redemptions (RETURNS TABLE; restricted to verified caller)
ALTER FUNCTION public.get_user_redemptions(UUID) RENAME TO _get_user_redemptions;
REVOKE ALL ON FUNCTION public._get_user_redemptions(UUID) FROM PUBLIC, anon, authenticated;
CREATE FUNCTION public.get_user_redemptions(p_init_data TEXT)
RETURNS TABLE (id UUID, category TEXT, amount INTEGER, details JSONB, status TEXT, admin_notes TEXT, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RETURN QUERY SELECT * FROM public._get_user_redemptions((public.app_user(p_init_data)).id);
END; $$;
GRANT EXECUTE ON FUNCTION public.get_user_redemptions(TEXT) TO anon, authenticated;

-- register_hackathon -----------------------------------------
ALTER FUNCTION public.register_hackathon(UUID, UUID) RENAME TO _register_hackathon;
REVOKE ALL ON FUNCTION public._register_hackathon(UUID, UUID) FROM PUBLIC, anon, authenticated;
CREATE FUNCTION public.register_hackathon(p_init_data TEXT, p_hackathon_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RETURN public._register_hackathon((public.app_user(p_init_data)).id, p_hackathon_id);
END; $$;
GRANT EXECUTE ON FUNCTION public.register_hackathon(TEXT, UUID) TO anon, authenticated;

-- enter_raffle -----------------------------------------------
ALTER FUNCTION public.enter_raffle(UUID, UUID) RENAME TO _enter_raffle;
REVOKE ALL ON FUNCTION public._enter_raffle(UUID, UUID) FROM PUBLIC, anon, authenticated;
CREATE FUNCTION public.enter_raffle(p_init_data TEXT, p_raffle_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RETURN public._enter_raffle((public.app_user(p_init_data)).id, p_raffle_id);
END; $$;
GRANT EXECUTE ON FUNCTION public.enter_raffle(TEXT, UUID) TO anon, authenticated;

-- buy_streak_insurance ---------------------------------------
ALTER FUNCTION public.buy_streak_insurance(UUID) RENAME TO _buy_streak_insurance;
REVOKE ALL ON FUNCTION public._buy_streak_insurance(UUID) FROM PUBLIC, anon, authenticated;
CREATE FUNCTION public.buy_streak_insurance(p_init_data TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RETURN public._buy_streak_insurance((public.app_user(p_init_data)).id);
END; $$;
GRANT EXECUTE ON FUNCTION public.buy_streak_insurance(TEXT) TO anon, authenticated;

-- claim_promo_code -------------------------------------------
ALTER FUNCTION public.claim_promo_code(UUID, TEXT) RENAME TO _claim_promo_code;
REVOKE ALL ON FUNCTION public._claim_promo_code(UUID, TEXT) FROM PUBLIC, anon, authenticated;
CREATE FUNCTION public.claim_promo_code(p_init_data TEXT, p_code TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RETURN public._claim_promo_code((public.app_user(p_init_data)).id, p_code);
END; $$;
GRANT EXECUTE ON FUNCTION public.claim_promo_code(TEXT, TEXT) TO anon, authenticated;

-- process_referral (caller = the referred/new user) ----------
ALTER FUNCTION public.process_referral(UUID, TEXT) RENAME TO _process_referral;
REVOKE ALL ON FUNCTION public._process_referral(UUID, TEXT) FROM PUBLIC, anon, authenticated;
CREATE FUNCTION public.process_referral(p_init_data TEXT, p_referral_code TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RETURN public._process_referral((public.app_user(p_init_data)).id, p_referral_code);
END; $$;
GRANT EXECUTE ON FUNCTION public.process_referral(TEXT, TEXT) TO anon, authenticated;

-- check_achievements -----------------------------------------
ALTER FUNCTION public.check_achievements(UUID) RENAME TO _check_achievements;
REVOKE ALL ON FUNCTION public._check_achievements(UUID) FROM PUBLIC, anon, authenticated;
CREATE FUNCTION public.check_achievements(p_init_data TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RETURN public._check_achievements((public.app_user(p_init_data)).id);
END; $$;
GRANT EXECUTE ON FUNCTION public.check_achievements(TEXT) TO anon, authenticated;

-- apply_inactivity_penalty (caller may only penalize themselves)
ALTER FUNCTION public.apply_inactivity_penalty(UUID) RENAME TO _apply_inactivity_penalty;
REVOKE ALL ON FUNCTION public._apply_inactivity_penalty(UUID) FROM PUBLIC, anon, authenticated;
CREATE FUNCTION public.apply_inactivity_penalty(p_init_data TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RETURN public._apply_inactivity_penalty((public.app_user(p_init_data)).id);
END; $$;
GRANT EXECUTE ON FUNCTION public.apply_inactivity_penalty(TEXT) TO anon, authenticated;

-- join_state -------------------------------------------------
ALTER FUNCTION public.join_state(UUID, UUID) RENAME TO _join_state;
REVOKE ALL ON FUNCTION public._join_state(UUID, UUID) FROM PUBLIC, anon, authenticated;
CREATE FUNCTION public.join_state(p_init_data TEXT, p_state_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RETURN public._join_state((public.app_user(p_init_data)).id, p_state_id);
END; $$;
GRANT EXECUTE ON FUNCTION public.join_state(TEXT, UUID) TO anon, authenticated;

-- leave_state ------------------------------------------------
ALTER FUNCTION public.leave_state(UUID) RENAME TO _leave_state;
REVOKE ALL ON FUNCTION public._leave_state(UUID) FROM PUBLIC, anon, authenticated;
CREATE FUNCTION public.leave_state(p_init_data TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RETURN public._leave_state((public.app_user(p_init_data)).id);
END; $$;
GRANT EXECUTE ON FUNCTION public.leave_state(TEXT) TO anon, authenticated;

-- join_pair_queue --------------------------------------------
ALTER FUNCTION public.join_pair_queue(UUID) RENAME TO _join_pair_queue;
REVOKE ALL ON FUNCTION public._join_pair_queue(UUID) FROM PUBLIC, anon, authenticated;
CREATE FUNCTION public.join_pair_queue(p_init_data TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RETURN public._join_pair_queue((public.app_user(p_init_data)).id);
END; $$;
GRANT EXECUTE ON FUNCTION public.join_pair_queue(TEXT) TO anon, authenticated;

-- rate_pair --------------------------------------------------
ALTER FUNCTION public.rate_pair(UUID, UUID, INTEGER, TEXT) RENAME TO _rate_pair;
REVOKE ALL ON FUNCTION public._rate_pair(UUID, UUID, INTEGER, TEXT) FROM PUBLIC, anon, authenticated;
CREATE FUNCTION public.rate_pair(p_init_data TEXT, p_pair_id UUID, p_rating INTEGER, p_comment TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RETURN public._rate_pair((public.app_user(p_init_data)).id, p_pair_id, p_rating, p_comment);
END; $$;
GRANT EXECUTE ON FUNCTION public.rate_pair(TEXT, UUID, INTEGER, TEXT) TO anon, authenticated;

-- keep_pair --------------------------------------------------
ALTER FUNCTION public.keep_pair(UUID, UUID) RENAME TO _keep_pair;
REVOKE ALL ON FUNCTION public._keep_pair(UUID, UUID) FROM PUBLIC, anon, authenticated;
CREATE FUNCTION public.keep_pair(p_init_data TEXT, p_pair_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RETURN public._keep_pair((public.app_user(p_init_data)).id, p_pair_id);
END; $$;
GRANT EXECUTE ON FUNCTION public.keep_pair(TEXT, UUID) TO anon, authenticated;

-- checkin_for_pair -------------------------------------------
ALTER FUNCTION public.checkin_for_pair(UUID, UUID) RENAME TO _checkin_for_pair;
REVOKE ALL ON FUNCTION public._checkin_for_pair(UUID, UUID) FROM PUBLIC, anon, authenticated;
CREATE FUNCTION public.checkin_for_pair(p_init_data TEXT, p_pair_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RETURN public._checkin_for_pair((public.app_user(p_init_data)).id, p_pair_id);
END; $$;
GRANT EXECUTE ON FUNCTION public.checkin_for_pair(TEXT, UUID) TO anon, authenticated;

-- ============================================================
-- ADMIN ACTIONS — caller resolved + is_admin re-checked server-side
-- ============================================================

-- draw_raffle_winner -----------------------------------------
ALTER FUNCTION public.draw_raffle_winner(UUID, UUID) RENAME TO _draw_raffle_winner;
REVOKE ALL ON FUNCTION public._draw_raffle_winner(UUID, UUID) FROM PUBLIC, anon, authenticated;
CREATE FUNCTION public.draw_raffle_winner(p_init_data TEXT, p_raffle_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_admin public.users;
BEGIN
  v_admin := public.app_user(p_init_data);
  IF NOT COALESCE(v_admin.is_admin, FALSE) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;
  RETURN public._draw_raffle_winner(v_admin.id, p_raffle_id);
END; $$;
GRANT EXECUTE ON FUNCTION public.draw_raffle_winner(TEXT, UUID) TO anon, authenticated;

-- approve_mission_submission ---------------------------------
ALTER FUNCTION public.approve_mission_submission(UUID, UUID) RENAME TO _approve_mission_submission;
REVOKE ALL ON FUNCTION public._approve_mission_submission(UUID, UUID) FROM PUBLIC, anon, authenticated;
CREATE FUNCTION public.approve_mission_submission(p_init_data TEXT, p_completion_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_admin public.users;
BEGIN
  v_admin := public.app_user(p_init_data);
  IF NOT COALESCE(v_admin.is_admin, FALSE) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;
  RETURN public._approve_mission_submission(v_admin.id, p_completion_id);
END; $$;
GRANT EXECUTE ON FUNCTION public.approve_mission_submission(TEXT, UUID) TO anon, authenticated;

-- reject_mission_submission ----------------------------------
ALTER FUNCTION public.reject_mission_submission(UUID, UUID) RENAME TO _reject_mission_submission;
REVOKE ALL ON FUNCTION public._reject_mission_submission(UUID, UUID) FROM PUBLIC, anon, authenticated;
CREATE FUNCTION public.reject_mission_submission(p_init_data TEXT, p_completion_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_admin public.users;
BEGIN
  v_admin := public.app_user(p_init_data);
  IF NOT COALESCE(v_admin.is_admin, FALSE) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;
  RETURN public._reject_mission_submission(v_admin.id, p_completion_id);
END; $$;
GRANT EXECUTE ON FUNCTION public.reject_mission_submission(TEXT, UUID) TO anon, authenticated;

-- process_redemption -----------------------------------------
ALTER FUNCTION public.process_redemption(UUID, UUID, TEXT, TEXT) RENAME TO _process_redemption;
REVOKE ALL ON FUNCTION public._process_redemption(UUID, UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
CREATE FUNCTION public.process_redemption(p_init_data TEXT, p_request_id UUID, p_action TEXT, p_notes TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_admin public.users;
BEGIN
  v_admin := public.app_user(p_init_data);
  IF NOT COALESCE(v_admin.is_admin, FALSE) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;
  RETURN public._process_redemption(v_admin.id, p_request_id, p_action, p_notes);
END; $$;
GRANT EXECUTE ON FUNCTION public.process_redemption(TEXT, UUID, TEXT, TEXT) TO anon, authenticated;

-- admin_delete_user (caller = admin; p_user_id = target) ------
ALTER FUNCTION public.admin_delete_user(UUID, UUID) RENAME TO _admin_delete_user;
REVOKE ALL ON FUNCTION public._admin_delete_user(UUID, UUID) FROM PUBLIC, anon, authenticated;
CREATE FUNCTION public.admin_delete_user(p_init_data TEXT, p_user_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_admin public.users;
BEGIN
  v_admin := public.app_user(p_init_data);
  IF NOT COALESCE(v_admin.is_admin, FALSE) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;
  RETURN public._admin_delete_user(v_admin.id, p_user_id);
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(TEXT, UUID) TO anon, authenticated;

-- delete_state -----------------------------------------------
ALTER FUNCTION public.delete_state(UUID, UUID) RENAME TO _delete_state;
REVOKE ALL ON FUNCTION public._delete_state(UUID, UUID) FROM PUBLIC, anon, authenticated;
CREATE FUNCTION public.delete_state(p_init_data TEXT, p_state_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_admin public.users;
BEGIN
  v_admin := public.app_user(p_init_data);
  IF NOT COALESCE(v_admin.is_admin, FALSE) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;
  RETURN public._delete_state(v_admin.id, p_state_id);
END; $$;
GRANT EXECUTE ON FUNCTION public.delete_state(TEXT, UUID) TO anon, authenticated;

-- process_activity_proof -------------------------------------
ALTER FUNCTION public.process_activity_proof(UUID, UUID, TEXT) RENAME TO _process_activity_proof;
REVOKE ALL ON FUNCTION public._process_activity_proof(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
CREATE FUNCTION public.process_activity_proof(p_init_data TEXT, p_log_id UUID, p_action TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_admin public.users;
BEGIN
  v_admin := public.app_user(p_init_data);
  IF NOT COALESCE(v_admin.is_admin, FALSE) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;
  RETURN public._process_activity_proof(v_admin.id, p_log_id, p_action);
END; $$;
GRANT EXECUTE ON FUNCTION public.process_activity_proof(TEXT, UUID, TEXT) TO anon, authenticated;

-- auto_pair_dreamers (was UNAUTHENTICATED; now admin-only) ----
ALTER FUNCTION public.auto_pair_dreamers() RENAME TO _auto_pair_dreamers;
REVOKE ALL ON FUNCTION public._auto_pair_dreamers() FROM PUBLIC, anon, authenticated;
CREATE FUNCTION public.auto_pair_dreamers(p_init_data TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_admin public.users;
BEGIN
  v_admin := public.app_user(p_init_data);
  IF NOT COALESCE(v_admin.is_admin, FALSE) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;
  RETURN public._auto_pair_dreamers();
END; $$;
GRANT EXECUTE ON FUNCTION public.auto_pair_dreamers(TEXT) TO anon, authenticated;

COMMIT;
