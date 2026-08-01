-- ============================================================
-- AUDIT: any table anon/authenticated can still write directly.
-- ------------------------------------------------------------
-- Every legitimate write in this app goes through a SECURITY
-- DEFINER RPC gated on verified initData. Any row this query
-- returns is a direct-write bypass of that gateway -- run this
-- after ANY migration that creates a new table or touches grants,
-- since a new table defaults to inheriting broad grants and is
-- silently exploitable until explicitly revoked (this is exactly
-- how the magic_boxes / support_campaigns tables were found wide
-- open on 2026-08-01, six weeks after the rest of the app was
-- locked down).
--
-- Run with:
--   supabase db query --linked -f scripts/audit-write-grants.sql
--
-- Expect ZERO rows. Anything else needs a REVOKE migration before
-- the next deploy.
-- ============================================================

select table_name, grantee, string_agg(privilege_type, ', ' order by privilege_type) as privileges
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee in ('anon', 'authenticated')
  and privilege_type in ('INSERT', 'UPDATE', 'DELETE')
group by table_name, grantee
order by table_name, grantee;
