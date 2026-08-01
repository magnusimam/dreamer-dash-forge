-- ============================================================
-- PHASE 2H — WRITE LOCKDOWN FOR TABLES ADDED BY THE FEATURE
-- BRANCH MERGED FROM origin/main (Magic Boxes, Community Support,
-- level rewards, streak bonuses).
-- ------------------------------------------------------------
-- These tables were created after 20260618_phase2_rls_write_lockdown.sql
-- was written, so they were never covered by it and were confirmed
-- (2026-08-01) to still grant anon/authenticated direct INSERT/UPDATE/
-- DELETE — e.g. a client could reset magic_box_entries.claimed to
-- re-claim a prize, or forge support_contributions rows, bypassing the
-- RPCs entirely. Same fix as Phase 2C: revoke at the privilege level;
-- SECURITY DEFINER RPCs (owned by postgres) are unaffected.
--
-- Apply AFTER 20260624_phase2g_new_feature_rpc_auth.sql and the
-- matching frontend deploy, for the same reason as Phase 2C.
-- ============================================================

BEGIN;

DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
    'magic_boxes', 'magic_box_entries', 'level_rewards_claimed',
    'streak_bonuses_claimed', 'support_campaigns', 'support_contributions'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    BEGIN
      EXECUTE format('REVOKE INSERT, UPDATE, DELETE ON public.%I FROM anon, authenticated', t);
    EXCEPTION
      WHEN undefined_table THEN RAISE NOTICE 'skip: table public.% does not exist', t;
      WHEN undefined_object THEN RAISE NOTICE 'skip: role missing for public.%', t;
    END;
  END LOOP;
END $$;

COMMIT;
