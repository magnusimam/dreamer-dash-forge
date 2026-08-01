-- ============================================================
-- PHASE 2C — WRITE LOCKDOWN
-- ------------------------------------------------------------
-- Revokes ALL direct client write access. Every legitimate write
-- now goes through a SECURITY DEFINER RPC (owned by postgres), which
-- is unaffected by these revokes. This is enforced at the table
-- PRIVILEGE level, so it holds regardless of any lingering
-- permissive `USING (true)` RLS policy.
--
-- APPLY THIS LAST — after the Phase 2A/2B migrations are applied AND
-- the updated frontend (which calls the new RPCs) is deployed.
-- Otherwise direct-write features will start returning permission
-- errors before the RPC paths are live.
--
-- service_role (edge functions) and the table owner are NOT revoked.
-- SELECT is left intact (reads still work); bank-PII column reads are
-- handled in a later step.
-- ============================================================

BEGIN;

DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
    -- ledger / economy (written only by RPCs)
    'users', 'transactions', 'daily_checkins', 'mission_completions', 'activity_logs',
    'hackathon_registrations', 'referrals', 'user_achievements', 'raffle_entries',
    'mission_unlocks', 'token_supply', 'admin_audit_log',
    'promo_codes', 'redemption_requests', 'redemption_categories',
    -- content (now written via admin_* RPCs)
    'raffles', 'missions', 'mentors', 'activities', 'hackathons', 'states',
    'weekly_mvps', 'featured_dreamers',
    -- social / pairs
    'dream_pairs', 'pair_queue', 'pair_pokes', 'state_rankings', 'achievements'
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

-- Belt-and-suspenders: drop the two most dangerous always-true write
-- policies on users (harmless once privileges are revoked, but removes
-- the misleading "admins can update any user" footgun).
DROP POLICY IF EXISTS "Admins can update any user" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;

COMMIT;
