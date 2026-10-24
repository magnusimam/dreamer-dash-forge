-- ============================================================
-- GRANULAR ADMIN PERMISSIONS
-- ------------------------------------------------------------
-- Until now there were two tiers: super admins (everything) and
-- moderators (is_admin only). The split was enforced only in the
-- Admin page UI — every admin RPC just checked is_admin, so a
-- moderator could call e.g. admin_create_raffle directly.
--
-- Now each non-super admin carries an explicit list of Admin-panel
-- sections they may use (users.admin_permissions), a super admin can
-- grant/revoke it per user from the Users tab, and the content RPCs
-- enforce the matching permission server-side.
--
-- Permission keys match the Admin page tab values:
--   activities missions magicbox support hackathons redemptions
--   proofs raffles promos ads users referrals settings states broadcast
--
-- Balance adjustment and user deletion are not delegable: they now
-- require is_super_admin server-side (the UI already hid them).
--
-- Function bodies below the helpers are the live definitions as of
-- 2026-10-24 with only the admin check swapped.
--
-- Also: ensure_featured_dreamer no longer excludes admins.
-- ============================================================

BEGIN;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS admin_permissions TEXT[] NOT NULL DEFAULT '{}';

-- Existing moderators keep exactly the tabs they could already see.
UPDATE public.users
SET admin_permissions = ARRAY['activities','support','hackathons','redemptions','proofs','users','referrals','broadcast']
WHERE is_admin = TRUE AND is_super_admin = FALSE AND admin_permissions = '{}';

-- TRUE iff the user is a super admin, or an admin holding p_perm.
CREATE OR REPLACE FUNCTION public.admin_can(p_user public.users, p_perm TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SET search_path = public, pg_temp AS $$
  SELECT COALESCE(p_user.is_admin, FALSE)
     AND (COALESCE(p_user.is_super_admin, FALSE) OR p_perm = ANY(COALESCE(p_user.admin_permissions, '{}')));
$$;
REVOKE ALL ON FUNCTION public.admin_can(public.users, TEXT) FROM PUBLIC, anon, authenticated;

-- Like app_admin, but also requires p_perm.
CREATE OR REPLACE FUNCTION public.app_admin_can(p_init_data TEXT, p_perm TEXT)
RETURNS public.users
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_u public.users;
BEGIN
  v_u := public.app_user(p_init_data);
  IF NOT public.admin_can(v_u, p_perm) THEN
    RAISE EXCEPTION 'unauthorized: % permission required', p_perm;
  END IF;
  RETURN v_u;
END; $$;
REVOKE ALL ON FUNCTION public.app_admin_can(TEXT, TEXT) FROM PUBLIC, anon, authenticated;

-- Super admin grants/revokes admin access and its sections for a user.
CREATE OR REPLACE FUNCTION public.admin_set_user_access(
  p_init_data TEXT, p_user_id UUID, p_is_admin BOOLEAN, p_permissions TEXT[]
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_admin   public.users;
  v_target  public.users;
  v_allowed CONSTANT TEXT[] := ARRAY['activities','missions','magicbox','support','hackathons','redemptions',
                                     'proofs','raffles','promos','ads','users','referrals','settings','states','broadcast'];
  v_perms   TEXT[];
BEGIN
  v_admin := public.app_user(p_init_data);
  IF NOT (COALESCE(v_admin.is_admin, FALSE) AND COALESCE(v_admin.is_super_admin, FALSE)) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;

  IF v_admin.id = p_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot change your own access');
  END IF;

  SELECT * INTO v_target FROM public.users WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;
  IF v_target.is_super_admin THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot change a super admin''s access');
  END IF;

  SELECT COALESCE(array_agg(DISTINCT p ORDER BY p), '{}') INTO v_perms
  FROM unnest(COALESCE(p_permissions, '{}')) p WHERE p = ANY(v_allowed);

  IF NOT COALESCE(p_is_admin, FALSE) THEN
    v_perms := '{}';
  ELSIF cardinality(v_perms) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pick at least one section');
  END IF;

  UPDATE public.users
  SET is_admin = COALESCE(p_is_admin, FALSE), admin_permissions = v_perms
  WHERE id = p_user_id;

  INSERT INTO public.admin_audit_log (admin_id, action, target_user_id, amount, reason)
  VALUES (v_admin.id, 'set_admin_access', p_user_id, 0,
          CASE WHEN COALESCE(p_is_admin, FALSE) THEN 'Granted: ' || array_to_string(v_perms, ', ') ELSE 'Revoked admin access' END);

  RETURN jsonb_build_object('success', true, 'is_admin', COALESCE(p_is_admin, FALSE), 'permissions', to_jsonb(v_perms));
END; $$;
REVOKE ALL ON FUNCTION public.admin_set_user_access(TEXT, UUID, BOOLEAN, TEXT[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_user_access(TEXT, UUID, BOOLEAN, TEXT[]) TO anon, authenticated;

-- ============================================================
-- Existing admin RPCs: swap the bare is_admin check for a permission
-- ============================================================

-- admin_adjust_balance: super admin only
CREATE OR REPLACE FUNCTION public.admin_adjust_balance(p_init_data text, p_user_id uuid, p_amount integer, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_admin       public.users;
  v_user        public.users;
  v_today_total INTEGER;
BEGIN
  v_admin := public.app_user(p_init_data);
  IF NOT (COALESCE(v_admin.is_admin, FALSE) AND COALESCE(v_admin.is_super_admin, FALSE)) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;

  IF v_admin.id = p_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot adjust your own balance');
  END IF;

  SELECT COALESCE(SUM(ABS(amount)), 0) INTO v_today_total
  FROM public.admin_audit_log
  WHERE admin_id = v_admin.id AND created_at::date = CURRENT_DATE;

  IF v_today_total + ABS(p_amount) > 5000 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Admin daily adjustment limit reached (5,000 DR/day)');
  END IF;

  SELECT * INTO v_user FROM public.users WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  IF v_user.balance + p_amount < 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Would result in negative balance');
  END IF;

  IF p_amount > 0 AND v_user.balance + p_amount > 50000 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Would exceed wallet cap (50,000 DR)');
  END IF;

  IF p_amount > 0 THEN
    IF NOT public.can_emit(p_amount) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Daily distribution limit reached or treasury empty');
    END IF;
    PERFORM public.record_emission(p_amount);
  ELSE
    PERFORM public.record_recycling(ABS(p_amount));
  END IF;

  UPDATE public.users SET
    balance = balance + p_amount,
    total_earned = CASE WHEN p_amount > 0 THEN total_earned + p_amount ELSE total_earned END
  WHERE id = p_user_id;

  INSERT INTO public.transactions (user_id, type, amount, description)
  VALUES (p_user_id, 'bonus', p_amount, 'Admin adjustment: ' || p_reason);

  INSERT INTO public.admin_audit_log (admin_id, action, target_user_id, amount, reason)
  VALUES (v_admin.id, 'balance_adjustment', p_user_id, p_amount, p_reason);

  RETURN jsonb_build_object('success', true, 'new_balance', v_user.balance + p_amount, 'user', v_user.first_name);
END;
$function$;

-- admin_archive_magic_box: magicbox
CREATE OR REPLACE FUNCTION public.admin_archive_magic_box(p_init_data text, p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  PERFORM public.app_admin_can(p_init_data, 'magicbox');
  UPDATE public.magic_boxes SET status = 'ended' WHERE id = p_id;
END; $function$;

-- admin_create_activity: activities
CREATE OR REPLACE FUNCTION public.admin_create_activity(p_init_data text, p_title text, p_category text, p_date date, p_reward integer, p_code text, p_description text DEFAULT NULL::text, p_max_participants integer DEFAULT NULL::integer, p_code_required boolean DEFAULT true, p_proof_required boolean DEFAULT false)
 RETURNS activities
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_admin public.users; v_row public.activities;
BEGIN
  v_admin := public.app_admin_can(p_init_data, 'activities');
  INSERT INTO public.activities (title, category, date, reward, code, description, max_participants, code_required, proof_required, created_by)
  VALUES (p_title, p_category, p_date, p_reward, p_code, p_description, p_max_participants,
          COALESCE(p_code_required, TRUE), COALESCE(p_proof_required, FALSE), v_admin.id)
  RETURNING * INTO v_row;
  RETURN v_row;
END; $function$;

-- admin_create_ad: ads
CREATE OR REPLACE FUNCTION public.admin_create_ad(p_init_data text, p_title text, p_body text DEFAULT ''::text, p_cta_label text DEFAULT ''::text, p_cta_url text DEFAULT ''::text, p_display_order integer DEFAULT 0)
 RETURNS ads
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_row public.ads;
BEGIN
  PERFORM public.app_admin_can(p_init_data, 'ads');
  INSERT INTO public.ads (title, body, cta_label, cta_url, display_order)
  VALUES (p_title, COALESCE(p_body, ''), COALESCE(p_cta_label, ''), COALESCE(p_cta_url, ''), COALESCE(p_display_order, 0))
  RETURNING * INTO v_row;
  RETURN v_row;
END; $function$;

-- admin_create_hackathon: hackathons
CREATE OR REPLACE FUNCTION public.admin_create_hackathon(p_init_data text, p_title text, p_start_date date, p_end_date date, p_entry_fee integer, p_prize_pool integer, p_description text DEFAULT NULL::text, p_max_teams integer DEFAULT NULL::integer, p_cover_image_url text DEFAULT NULL::text)
 RETURNS hackathons
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_admin public.users; v_row public.hackathons;
BEGIN
  v_admin := public.app_admin_can(p_init_data, 'hackathons');
  INSERT INTO public.hackathons (title, start_date, end_date, entry_fee, prize_pool, description, max_teams, cover_image_url, created_by)
  VALUES (p_title, p_start_date, p_end_date, COALESCE(p_entry_fee, 0), COALESCE(p_prize_pool, 0),
          p_description, p_max_teams, p_cover_image_url, v_admin.id)
  RETURNING * INTO v_row;
  RETURN v_row;
END; $function$;

-- admin_create_magic_box: magicbox
CREATE OR REPLACE FUNCTION public.admin_create_magic_box(p_init_data text, p_title text, p_entry_fee integer, p_prize_dr integer, p_prize_xp integer, p_description text DEFAULT NULL::text, p_prize_custom text DEFAULT NULL::text, p_max_entries integer DEFAULT NULL::integer, p_allowed_usernames text[] DEFAULT NULL::text[], p_expires_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_reveal_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS magic_boxes
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_admin public.users; v_row public.magic_boxes;
BEGIN
  v_admin := public.app_admin_can(p_init_data, 'magicbox');
  INSERT INTO public.magic_boxes
    (title, description, entry_fee, prize_dr, prize_xp, prize_custom, max_entries, allowed_usernames, expires_at, reveal_at, created_by)
  VALUES
    (p_title, p_description, COALESCE(p_entry_fee, 100), COALESCE(p_prize_dr, 0), COALESCE(p_prize_xp, 0),
     p_prize_custom, p_max_entries, p_allowed_usernames, p_expires_at, p_reveal_at, v_admin.id)
  RETURNING * INTO v_row;
  RETURN v_row;
END; $function$;

-- admin_create_mentor: settings
CREATE OR REPLACE FUNCTION public.admin_create_mentor(p_init_data text, p_name text, p_specialty text, p_contact_info text)
 RETURNS mentors
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_row public.mentors;
BEGIN
  PERFORM public.app_admin_can(p_init_data, 'settings');
  INSERT INTO public.mentors (name, specialty, contact_info)
  VALUES (p_name, COALESCE(p_specialty, ''), COALESCE(p_contact_info, ''))
  RETURNING * INTO v_row;
  RETURN v_row;
END; $function$;

-- admin_create_mission: missions
CREATE OR REPLACE FUNCTION public.admin_create_mission(p_init_data text, p_title text, p_category text, p_reward integer, p_description text DEFAULT NULL::text, p_unlock_fee integer DEFAULT 0, p_completion_code text DEFAULT NULL::text, p_expires_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS missions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_row public.missions;
BEGIN
  PERFORM public.app_admin_can(p_init_data, 'missions');
  INSERT INTO public.missions (title, category, reward, description, unlock_fee, completion_code, expires_at)
  VALUES (p_title, p_category, p_reward, p_description, COALESCE(p_unlock_fee, 0), p_completion_code, p_expires_at)
  RETURNING * INTO v_row;
  RETURN v_row;
END; $function$;

-- admin_create_promo_code: promos
CREATE OR REPLACE FUNCTION public.admin_create_promo_code(p_init_data text, p_code text, p_reward integer, p_description text DEFAULT NULL::text)
 RETURNS promo_codes
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_admin public.users; v_row public.promo_codes;
BEGIN
  v_admin := public.app_admin_can(p_init_data, 'promos');
  INSERT INTO public.promo_codes (code, reward, description, created_by)
  VALUES (UPPER(TRIM(p_code)), p_reward, p_description, v_admin.id)
  RETURNING * INTO v_row;
  RETURN v_row;
END; $function$;

-- admin_create_raffle: raffles
CREATE OR REPLACE FUNCTION public.admin_create_raffle(p_init_data text, p_title text, p_entry_fee integer, p_end_date timestamp with time zone, p_description text DEFAULT NULL::text, p_max_entries integer DEFAULT NULL::integer)
 RETURNS raffles
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_admin public.users; v_row public.raffles;
BEGIN
  v_admin := public.app_admin_can(p_init_data, 'raffles');
  INSERT INTO public.raffles (title, entry_fee, end_date, description, max_entries, created_by)
  VALUES (p_title, COALESCE(p_entry_fee, 50), p_end_date, p_description, p_max_entries, v_admin.id)
  RETURNING * INTO v_row;
  RETURN v_row;
END; $function$;

-- admin_create_state: states
CREATE OR REPLACE FUNCTION public.admin_create_state(p_init_data text, p_name text)
 RETURNS states
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_row public.states;
BEGIN
  PERFORM public.app_admin_can(p_init_data, 'states');
  INSERT INTO public.states (name) VALUES (p_name) RETURNING * INTO v_row;
  RETURN v_row;
END; $function$;

-- admin_create_support_campaign: support
CREATE OR REPLACE FUNCTION public.admin_create_support_campaign(p_init_data text, p_title text, p_beneficiary_name text, p_target_amount integer, p_description text DEFAULT NULL::text, p_beneficiary_user_id uuid DEFAULT NULL::uuid, p_bank_name text DEFAULT NULL::text, p_account_number text DEFAULT NULL::text, p_account_name text DEFAULT NULL::text, p_dr_reward_per_1000 integer DEFAULT NULL::integer, p_xp_reward_per_1000 integer DEFAULT NULL::integer)
 RETURNS support_campaigns
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_admin public.users; v_row public.support_campaigns;
BEGIN
  v_admin := public.app_admin_can(p_init_data, 'support');
  INSERT INTO public.support_campaigns
    (title, description, beneficiary_name, beneficiary_user_id, target_amount,
     bank_name, account_number, account_name, dr_reward_per_1000, xp_reward_per_1000, created_by)
  VALUES
    (p_title, p_description, p_beneficiary_name, p_beneficiary_user_id, p_target_amount,
     p_bank_name, p_account_number, p_account_name,
     COALESCE(p_dr_reward_per_1000, 50), COALESCE(p_xp_reward_per_1000, 1), v_admin.id)
  RETURNING * INTO v_row;
  RETURN v_row;
END; $function$;

-- admin_deactivate_raffle: raffles
CREATE OR REPLACE FUNCTION public.admin_deactivate_raffle(p_init_data text, p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  PERFORM public.app_admin_can(p_init_data, 'raffles');
  UPDATE public.raffles SET is_active = FALSE WHERE id = p_id;
END; $function$;

-- admin_delete_ad: ads
CREATE OR REPLACE FUNCTION public.admin_delete_ad(p_init_data text, p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  PERFORM public.app_admin_can(p_init_data, 'ads');
  DELETE FROM public.ads WHERE id = p_id;
END; $function$;

-- admin_delete_hackathon: hackathons
CREATE OR REPLACE FUNCTION public.admin_delete_hackathon(p_init_data text, p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  PERFORM public.app_admin_can(p_init_data, 'hackathons');
  DELETE FROM public.hackathons WHERE id = p_id;
END; $function$;

-- admin_delete_mentor: settings
CREATE OR REPLACE FUNCTION public.admin_delete_mentor(p_init_data text, p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  PERFORM public.app_admin_can(p_init_data, 'settings');
  DELETE FROM public.mentors WHERE id = p_id;
END; $function$;

-- admin_delete_promo_code: promos
CREATE OR REPLACE FUNCTION public.admin_delete_promo_code(p_init_data text, p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  PERFORM public.app_admin_can(p_init_data, 'promos');
  DELETE FROM public.promo_codes WHERE id = p_id;
END; $function$;

-- admin_delete_user: super admin only
CREATE OR REPLACE FUNCTION public.admin_delete_user(p_init_data text, p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_admin public.users;
BEGIN
  v_admin := public.app_user(p_init_data);
  IF NOT (COALESCE(v_admin.is_admin, FALSE) AND COALESCE(v_admin.is_super_admin, FALSE)) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;
  RETURN public._admin_delete_user(v_admin.id, p_user_id);
END; $function$;

-- admin_generate_promo_codes: promos
CREATE OR REPLACE FUNCTION public.admin_generate_promo_codes(p_init_data text, p_count integer, p_reward integer, p_description text DEFAULT NULL::text)
 RETURNS SETOF promo_codes
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_admin public.users;
BEGIN
  v_admin := public.app_admin_can(p_init_data, 'promos');
  IF p_count IS NULL OR p_count < 1 OR p_count > 500 THEN
    RAISE EXCEPTION 'count must be between 1 and 500';
  END IF;
  RETURN QUERY
  INSERT INTO public.promo_codes (code, reward, description, created_by)
  SELECT 'BREATH-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT || clock_timestamp()::TEXT || g::TEXT) FROM 1 FOR 6)),
         p_reward, p_description, v_admin.id
  FROM generate_series(1, p_count) AS g
  RETURNING *;
END; $function$;

-- admin_reactivate_raffle: raffles
CREATE OR REPLACE FUNCTION public.admin_reactivate_raffle(p_init_data text, p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  PERFORM public.app_admin_can(p_init_data, 'raffles');
  UPDATE public.raffles SET is_active = TRUE WHERE id = p_id;
END; $function$;

-- admin_set_activity_active: activities
CREATE OR REPLACE FUNCTION public.admin_set_activity_active(p_init_data text, p_id uuid, p_is_active boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  PERFORM public.app_admin_can(p_init_data, 'activities');
  UPDATE public.activities SET is_active = p_is_active WHERE id = p_id;
END; $function$;

-- admin_set_activity_status: activities
CREATE OR REPLACE FUNCTION public.admin_set_activity_status(p_init_data text, p_id uuid, p_status text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  PERFORM public.app_admin_can(p_init_data, 'activities');
  UPDATE public.activities SET status = p_status WHERE id = p_id;
END; $function$;

-- admin_set_mission_active: missions
CREATE OR REPLACE FUNCTION public.admin_set_mission_active(p_init_data text, p_id uuid, p_is_active boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  PERFORM public.app_admin_can(p_init_data, 'missions');
  UPDATE public.missions SET is_active = p_is_active WHERE id = p_id;
END; $function$;

-- admin_update_activity: activities
CREATE OR REPLACE FUNCTION public.admin_update_activity(p_init_data text, p_id uuid, p_title text DEFAULT NULL::text, p_description text DEFAULT NULL::text, p_category text DEFAULT NULL::text, p_date date DEFAULT NULL::date, p_reward integer DEFAULT NULL::integer, p_is_active boolean DEFAULT NULL::boolean)
 RETURNS activities
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_row public.activities;
BEGIN
  PERFORM public.app_admin_can(p_init_data, 'activities');
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
END; $function$;

-- admin_update_ad: ads
CREATE OR REPLACE FUNCTION public.admin_update_ad(p_init_data text, p_id uuid, p_title text DEFAULT NULL::text, p_body text DEFAULT NULL::text, p_cta_label text DEFAULT NULL::text, p_cta_url text DEFAULT NULL::text, p_is_active boolean DEFAULT NULL::boolean, p_display_order integer DEFAULT NULL::integer)
 RETURNS ads
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_row public.ads;
BEGIN
  PERFORM public.app_admin_can(p_init_data, 'ads');
  UPDATE public.ads SET
    title          = COALESCE(p_title, title),
    body           = COALESCE(p_body, body),
    cta_label      = COALESCE(p_cta_label, cta_label),
    cta_url        = COALESCE(p_cta_url, cta_url),
    is_active      = COALESCE(p_is_active, is_active),
    display_order  = COALESCE(p_display_order, display_order),
    updated_at     = NOW()
  WHERE id = p_id
  RETURNING * INTO v_row;
  RETURN v_row;
END; $function$;

-- admin_update_hackathon: hackathons
CREATE OR REPLACE FUNCTION public.admin_update_hackathon(p_init_data text, p_id uuid, p_title text DEFAULT NULL::text, p_description text DEFAULT NULL::text, p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date, p_entry_fee integer DEFAULT NULL::integer, p_prize_pool integer DEFAULT NULL::integer, p_max_teams integer DEFAULT NULL::integer, p_status text DEFAULT NULL::text, p_is_active boolean DEFAULT NULL::boolean)
 RETURNS hackathons
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_row public.hackathons;
BEGIN
  PERFORM public.app_admin_can(p_init_data, 'hackathons');
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
END; $function$;

-- admin_update_mentor: settings
CREATE OR REPLACE FUNCTION public.admin_update_mentor(p_init_data text, p_id uuid, p_name text DEFAULT NULL::text, p_specialty text DEFAULT NULL::text, p_contact_info text DEFAULT NULL::text, p_is_active boolean DEFAULT NULL::boolean)
 RETURNS mentors
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_row public.mentors;
BEGIN
  PERFORM public.app_admin_can(p_init_data, 'settings');
  UPDATE public.mentors SET
    name         = COALESCE(p_name, name),
    specialty    = COALESCE(p_specialty, specialty),
    contact_info = COALESCE(p_contact_info, contact_info),
    is_active    = COALESCE(p_is_active, is_active),
    updated_at   = NOW()
  WHERE id = p_id
  RETURNING * INTO v_row;
  RETURN v_row;
END; $function$;

-- admin_update_mission: missions
CREATE OR REPLACE FUNCTION public.admin_update_mission(p_init_data text, p_id uuid, p_title text DEFAULT NULL::text, p_description text DEFAULT NULL::text, p_reward integer DEFAULT NULL::integer, p_unlock_fee integer DEFAULT NULL::integer, p_completion_code text DEFAULT NULL::text, p_expires_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  PERFORM public.app_admin_can(p_init_data, 'missions');
  UPDATE public.missions SET
    title           = COALESCE(p_title, title),
    description      = COALESCE(p_description, description),
    reward          = COALESCE(p_reward, reward),
    unlock_fee      = COALESCE(p_unlock_fee, unlock_fee),
    completion_code = COALESCE(p_completion_code, completion_code),
    expires_at      = COALESCE(p_expires_at, expires_at)
  WHERE id = p_id;
END; $function$;

-- admin_update_redemption_category: settings
CREATE OR REPLACE FUNCTION public.admin_update_redemption_category(p_init_data text, p_id text, p_cost integer DEFAULT NULL::integer, p_description text DEFAULT NULL::text, p_is_active boolean DEFAULT NULL::boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  PERFORM public.app_admin_can(p_init_data, 'settings');
  UPDATE public.redemption_categories SET
    cost        = COALESCE(p_cost, cost),
    description = COALESCE(p_description, description),
    is_active   = COALESCE(p_is_active, is_active),
    updated_at  = NOW()
  WHERE id = p_id;
END; $function$;

-- approve_mission_submission: missions
CREATE OR REPLACE FUNCTION public.approve_mission_submission(p_init_data text, p_completion_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_admin public.users;
BEGIN
  v_admin := public.app_user(p_init_data);
  IF NOT public.admin_can(v_admin, 'missions') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;
  RETURN public._approve_mission_submission(v_admin.id, p_completion_id);
END; $function$;

-- draw_raffle_winner: raffles
CREATE OR REPLACE FUNCTION public.draw_raffle_winner(p_init_data text, p_raffle_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_admin public.users;
BEGIN
  v_admin := public.app_user(p_init_data);
  IF NOT public.admin_can(v_admin, 'raffles') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;
  RETURN public._draw_raffle_winner(v_admin.id, p_raffle_id);
END; $function$;

-- reject_mission_submission: missions
CREATE OR REPLACE FUNCTION public.reject_mission_submission(p_init_data text, p_completion_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_admin public.users;
BEGIN
  v_admin := public.app_user(p_init_data);
  IF NOT public.admin_can(v_admin, 'missions') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;
  RETURN public._reject_mission_submission(v_admin.id, p_completion_id);
END; $function$;

-- Featured Dreamer: admins are users too, so they're eligible.
CREATE OR REPLACE FUNCTION public.ensure_featured_dreamer(p_init_data text, p_week_start date)
 RETURNS TABLE(id uuid, first_name text, last_name text, username text, photo_url text, balance integer, streak integer, status text, last_active timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_featured UUID;
BEGIN
  PERFORM public.app_user(p_init_data);  -- require a verified caller

  SELECT user_id INTO v_featured FROM public.featured_dreamers WHERE week_start = p_week_start;

  IF v_featured IS NULL THEN
    SELECT u.id INTO v_featured FROM public.users u ORDER BY RANDOM() LIMIT 1;
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
END; $function$;

COMMIT;
