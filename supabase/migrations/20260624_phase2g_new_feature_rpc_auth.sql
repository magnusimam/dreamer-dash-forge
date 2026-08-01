-- ============================================================
-- PHASE 2G — RPC AUTH CONVERSION FOR FEATURE WORK MERGED FROM
-- origin/main (Magic Boxes, Community Support, streak bonuses/
-- restore/freeze, level rewards, Dream Pair extensions,
-- hackathon winners).
-- ------------------------------------------------------------
-- These RPCs were built on a separate branch before the Phase 1/2A
-- identity gateway existed, so they still trust a client-supplied
-- p_user_id/p_admin_id — the exact vulnerability class the gateway
-- closes elsewhere. Same strategy as 20260616_phase2_rpc_auth.sql:
--   1. rename the original (logic-preserving) to public._<name>
--   2. revoke anon/authenticated EXECUTE on the internal _<name>
--   3. create a thin wrapper public.<name>(p_init_data, <args>)
--      that resolves the caller with app_user() (+ is_admin check
--      for admin actions), then calls the internal function with
--      the VERIFIED id.
--
-- deny_pair_extension and set_hackathon_winner never made it to
-- this database at all yet, so they're created directly in the
-- secure form (no insecure signature ever exposed).
--
-- Atomic: wrapped in a transaction.
-- ============================================================

BEGIN;

-- ============================================================
-- USER ACTIONS — caller = app_user(initData)
-- ============================================================

-- accept_pair_extension ---------------------------------------
ALTER FUNCTION public.accept_pair_extension(UUID, UUID) RENAME TO _accept_pair_extension;
REVOKE ALL ON FUNCTION public._accept_pair_extension(UUID, UUID) FROM PUBLIC, anon, authenticated;
CREATE FUNCTION public.accept_pair_extension(p_init_data TEXT, p_pair_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RETURN public._accept_pair_extension((public.app_user(p_init_data)).id, p_pair_id);
END; $$;
GRANT EXECUTE ON FUNCTION public.accept_pair_extension(TEXT, UUID) TO anon, authenticated;

-- request_pair_extension ----------------------------------------
ALTER FUNCTION public.request_pair_extension(UUID, UUID) RENAME TO _request_pair_extension;
REVOKE ALL ON FUNCTION public._request_pair_extension(UUID, UUID) FROM PUBLIC, anon, authenticated;
CREATE FUNCTION public.request_pair_extension(p_init_data TEXT, p_pair_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RETURN public._request_pair_extension((public.app_user(p_init_data)).id, p_pair_id);
END; $$;
GRANT EXECUTE ON FUNCTION public.request_pair_extension(TEXT, UUID) TO anon, authenticated;

-- claim_level_reward ---------------------------------------------
ALTER FUNCTION public.claim_level_reward(UUID, INTEGER) RENAME TO _claim_level_reward;
REVOKE ALL ON FUNCTION public._claim_level_reward(UUID, INTEGER) FROM PUBLIC, anon, authenticated;
CREATE FUNCTION public.claim_level_reward(p_init_data TEXT, p_level INTEGER)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RETURN public._claim_level_reward((public.app_user(p_init_data)).id, p_level);
END; $$;
GRANT EXECUTE ON FUNCTION public.claim_level_reward(TEXT, INTEGER) TO anon, authenticated;

-- claim_magic_box --------------------------------------------------
ALTER FUNCTION public.claim_magic_box(UUID, UUID) RENAME TO _claim_magic_box;
REVOKE ALL ON FUNCTION public._claim_magic_box(UUID, UUID) FROM PUBLIC, anon, authenticated;
CREATE FUNCTION public.claim_magic_box(p_init_data TEXT, p_box_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RETURN public._claim_magic_box((public.app_user(p_init_data)).id, p_box_id);
END; $$;
GRANT EXECUTE ON FUNCTION public.claim_magic_box(TEXT, UUID) TO anon, authenticated;

-- open_magic_box -----------------------------------------------
ALTER FUNCTION public.open_magic_box(UUID, UUID) RENAME TO _open_magic_box;
REVOKE ALL ON FUNCTION public._open_magic_box(UUID, UUID) FROM PUBLIC, anon, authenticated;
CREATE FUNCTION public.open_magic_box(p_init_data TEXT, p_box_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RETURN public._open_magic_box((public.app_user(p_init_data)).id, p_box_id);
END; $$;
GRANT EXECUTE ON FUNCTION public.open_magic_box(TEXT, UUID) TO anon, authenticated;

-- claim_streak_bonus ---------------------------------------------
ALTER FUNCTION public.claim_streak_bonus(UUID, INTEGER) RENAME TO _claim_streak_bonus;
REVOKE ALL ON FUNCTION public._claim_streak_bonus(UUID, INTEGER) FROM PUBLIC, anon, authenticated;
CREATE FUNCTION public.claim_streak_bonus(p_init_data TEXT, p_milestone INTEGER)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RETURN public._claim_streak_bonus((public.app_user(p_init_data)).id, p_milestone);
END; $$;
GRANT EXECUTE ON FUNCTION public.claim_streak_bonus(TEXT, INTEGER) TO anon, authenticated;

-- freeze_streak (self-service streak insurance purchase) --------
ALTER FUNCTION public.freeze_streak(UUID, INTEGER) RENAME TO _freeze_streak;
REVOKE ALL ON FUNCTION public._freeze_streak(UUID, INTEGER) FROM PUBLIC, anon, authenticated;
CREATE FUNCTION public.freeze_streak(p_init_data TEXT, p_days INTEGER)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RETURN public._freeze_streak((public.app_user(p_init_data)).id, p_days);
END; $$;
GRANT EXECUTE ON FUNCTION public.freeze_streak(TEXT, INTEGER) TO anon, authenticated;

-- restore_streak ---------------------------------------------------
ALTER FUNCTION public.restore_streak(UUID) RENAME TO _restore_streak;
REVOKE ALL ON FUNCTION public._restore_streak(UUID) FROM PUBLIC, anon, authenticated;
CREATE FUNCTION public.restore_streak(p_init_data TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RETURN public._restore_streak((public.app_user(p_init_data)).id);
END; $$;
GRANT EXECUTE ON FUNCTION public.restore_streak(TEXT) TO anon, authenticated;

-- submit_contribution (Community Support campaign) ----------------
ALTER FUNCTION public.submit_contribution(UUID, UUID, INTEGER, TEXT) RENAME TO _submit_contribution;
REVOKE ALL ON FUNCTION public._submit_contribution(UUID, UUID, INTEGER, TEXT) FROM PUBLIC, anon, authenticated;
CREATE FUNCTION public.submit_contribution(p_init_data TEXT, p_campaign_id UUID, p_amount INTEGER, p_proof_url TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RETURN public._submit_contribution((public.app_user(p_init_data)).id, p_campaign_id, p_amount, p_proof_url);
END; $$;
GRANT EXECUTE ON FUNCTION public.submit_contribution(TEXT, UUID, INTEGER, TEXT) TO anon, authenticated;

-- deny_pair_extension — never existed on this DB; create secure from the start
CREATE FUNCTION public._deny_pair_extension(p_user_id UUID, p_pair_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_pair RECORD;
BEGIN
  SELECT * INTO v_pair FROM public.dream_pairs WHERE id = p_pair_id AND extension_status = 'pending';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'No pending extension');
  END IF;

  IF v_pair.extension_requested_by = p_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'You cannot deny your own request');
  END IF;

  UPDATE public.dream_pairs SET extension_status = 'denied' WHERE id = p_pair_id;

  RETURN jsonb_build_object('success', true);
END; $$;
REVOKE ALL ON FUNCTION public._deny_pair_extension(UUID, UUID) FROM PUBLIC, anon, authenticated;
CREATE FUNCTION public.deny_pair_extension(p_init_data TEXT, p_pair_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RETURN public._deny_pair_extension((public.app_user(p_init_data)).id, p_pair_id);
END; $$;
GRANT EXECUTE ON FUNCTION public.deny_pair_extension(TEXT, UUID) TO anon, authenticated;

-- ============================================================
-- ADMIN ACTIONS — caller resolved + is_admin re-checked server-side
-- ============================================================

-- approve_contribution ---------------------------------------------
ALTER FUNCTION public.approve_contribution(UUID, UUID) RENAME TO _approve_contribution;
REVOKE ALL ON FUNCTION public._approve_contribution(UUID, UUID) FROM PUBLIC, anon, authenticated;
CREATE FUNCTION public.approve_contribution(p_init_data TEXT, p_contribution_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_admin public.users;
BEGIN
  v_admin := public.app_user(p_init_data);
  IF NOT COALESCE(v_admin.is_admin, FALSE) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;
  RETURN public._approve_contribution(v_admin.id, p_contribution_id);
END; $$;
GRANT EXECUTE ON FUNCTION public.approve_contribution(TEXT, UUID) TO anon, authenticated;

-- reject_contribution ------------------------------------------------
ALTER FUNCTION public.reject_contribution(UUID, UUID) RENAME TO _reject_contribution;
REVOKE ALL ON FUNCTION public._reject_contribution(UUID, UUID) FROM PUBLIC, anon, authenticated;
CREATE FUNCTION public.reject_contribution(p_init_data TEXT, p_contribution_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_admin public.users;
BEGIN
  v_admin := public.app_user(p_init_data);
  IF NOT COALESCE(v_admin.is_admin, FALSE) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;
  RETURN public._reject_contribution(v_admin.id, p_contribution_id);
END; $$;
GRANT EXECUTE ON FUNCTION public.reject_contribution(TEXT, UUID) TO anon, authenticated;

-- set_hackathon_winner — never existed on this DB; create secure from the start
ALTER TABLE public.hackathons ADD COLUMN IF NOT EXISTS winner_id UUID REFERENCES public.users(id) ON DELETE SET NULL;

CREATE FUNCTION public._set_hackathon_winner(p_admin_id UUID, p_hackathon_id UUID, p_winner_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_hackathon RECORD;
  v_winner RECORD;
  v_is_registered BOOLEAN;
BEGIN
  SELECT * INTO v_hackathon FROM public.hackathons WHERE id = p_hackathon_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Hackathon not found');
  END IF;

  SELECT EXISTS(SELECT 1 FROM public.hackathon_registrations WHERE user_id = p_winner_id AND hackathon_id = p_hackathon_id) INTO v_is_registered;
  IF NOT v_is_registered THEN
    RETURN jsonb_build_object('success', false, 'error', 'Winner must be registered for this hackathon');
  END IF;

  SELECT * INTO v_winner FROM public.users WHERE id = p_winner_id;

  IF v_hackathon.prize_pool > 0 THEN
    UPDATE public.users SET balance = balance + v_hackathon.prize_pool, total_earned = total_earned + v_hackathon.prize_pool WHERE id = p_winner_id;
    INSERT INTO public.transactions (user_id, type, amount, description, reference_id)
    VALUES (p_winner_id, 'hackathon_prize', v_hackathon.prize_pool, 'Hackathon winner: ' || v_hackathon.title, v_hackathon.id);
    UPDATE public.token_supply SET hackathon_pool = GREATEST(hackathon_pool - v_hackathon.prize_pool, 0), total_circulating = total_circulating + v_hackathon.prize_pool WHERE id = 1;
  END IF;

  UPDATE public.hackathons SET winner_id = p_winner_id, status = 'completed' WHERE id = p_hackathon_id;

  RETURN jsonb_build_object('success', true, 'winner', v_winner.first_name, 'winner_username', v_winner.username, 'winner_telegram_id', v_winner.telegram_id, 'prize', v_hackathon.prize_pool);
END; $$;
REVOKE ALL ON FUNCTION public._set_hackathon_winner(UUID, UUID, UUID) FROM PUBLIC, anon, authenticated;
CREATE FUNCTION public.set_hackathon_winner(p_init_data TEXT, p_hackathon_id UUID, p_winner_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_admin public.users;
BEGIN
  v_admin := public.app_user(p_init_data);
  IF NOT COALESCE(v_admin.is_admin, FALSE) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;
  RETURN public._set_hackathon_winner(v_admin.id, p_hackathon_id, p_winner_id);
END; $$;
GRANT EXECUTE ON FUNCTION public.set_hackathon_winner(TEXT, UUID, UUID) TO anon, authenticated;

COMMIT;
