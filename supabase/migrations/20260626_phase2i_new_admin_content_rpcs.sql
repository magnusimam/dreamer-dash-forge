-- ============================================================
-- PHASE 2I — ADMIN CONTENT RPCs FOR MAGIC BOXES / COMMUNITY
-- SUPPORT CAMPAIGNS
-- ------------------------------------------------------------
-- These two tables (added by the feature branch merged from
-- origin/main) had their admin create/archive actions still going
-- through direct client INSERT/UPDATE — same gap Phase 2B closed
-- for raffles/missions/hackathons/etc. Apply BEFORE the matching
-- 20260625_phase2h_new_table_write_lockdown.sql lockdown, and
-- deploy the updated frontend before (or immediately after) both.
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.admin_create_support_campaign(
  p_init_data TEXT, p_title TEXT, p_beneficiary_name TEXT, p_target_amount INTEGER,
  p_description TEXT DEFAULT NULL, p_beneficiary_user_id UUID DEFAULT NULL,
  p_bank_name TEXT DEFAULT NULL, p_account_number TEXT DEFAULT NULL, p_account_name TEXT DEFAULT NULL,
  p_dr_reward_per_1000 INTEGER DEFAULT NULL, p_xp_reward_per_1000 INTEGER DEFAULT NULL)
RETURNS public.support_campaigns LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_admin public.users; v_row public.support_campaigns;
BEGIN
  v_admin := public.app_admin(p_init_data);
  INSERT INTO public.support_campaigns
    (title, description, beneficiary_name, beneficiary_user_id, target_amount,
     bank_name, account_number, account_name, dr_reward_per_1000, xp_reward_per_1000, created_by)
  VALUES
    (p_title, p_description, p_beneficiary_name, p_beneficiary_user_id, p_target_amount,
     p_bank_name, p_account_number, p_account_name,
     COALESCE(p_dr_reward_per_1000, 50), COALESCE(p_xp_reward_per_1000, 1), v_admin.id)
  RETURNING * INTO v_row;
  RETURN v_row;
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_create_support_campaign(TEXT, TEXT, TEXT, INTEGER, TEXT, UUID, TEXT, TEXT, TEXT, INTEGER, INTEGER) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_create_magic_box(
  p_init_data TEXT, p_title TEXT, p_entry_fee INTEGER, p_prize_dr INTEGER, p_prize_xp INTEGER,
  p_description TEXT DEFAULT NULL, p_prize_custom TEXT DEFAULT NULL, p_max_entries INTEGER DEFAULT NULL,
  p_allowed_usernames TEXT[] DEFAULT NULL, p_expires_at TIMESTAMPTZ DEFAULT NULL, p_reveal_at TIMESTAMPTZ DEFAULT NULL)
RETURNS public.magic_boxes LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_admin public.users; v_row public.magic_boxes;
BEGIN
  v_admin := public.app_admin(p_init_data);
  INSERT INTO public.magic_boxes
    (title, description, entry_fee, prize_dr, prize_xp, prize_custom, max_entries, allowed_usernames, expires_at, reveal_at, created_by)
  VALUES
    (p_title, p_description, COALESCE(p_entry_fee, 100), COALESCE(p_prize_dr, 0), COALESCE(p_prize_xp, 0),
     p_prize_custom, p_max_entries, p_allowed_usernames, p_expires_at, p_reveal_at, v_admin.id)
  RETURNING * INTO v_row;
  RETURN v_row;
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_create_magic_box(TEXT, TEXT, INTEGER, INTEGER, INTEGER, TEXT, TEXT, INTEGER, TEXT[], TIMESTAMPTZ, TIMESTAMPTZ) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_archive_magic_box(p_init_data TEXT, p_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM public.app_admin(p_init_data);
  UPDATE public.magic_boxes SET status = 'ended' WHERE id = p_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_archive_magic_box(TEXT, UUID) TO anon, authenticated;

COMMIT;
