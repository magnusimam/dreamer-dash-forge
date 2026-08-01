-- ============================================================
-- PHASE 2J — PRIVILEGE-LEVEL LOCKDOWN FOR app_settings
-- ------------------------------------------------------------
-- Found by the new write-grant audit (scripts/audit-write-grants.sql,
-- 2026-08-01): app_settings -- the table holding telegram_bot_token,
-- cron_secret, and edge_bearer -- still granted anon/authenticated
-- full SELECT/INSERT/UPDATE/DELETE at the table-privilege level.
--
-- This was NOT currently exploitable: a `USING (false)` RLS policy
-- ("No client access to app_settings") blocks SELECT, and the absence
-- of any INSERT/UPDATE/DELETE policy denies those by default while
-- RLS is enabled -- confirmed empirically (SELECT returns [], INSERT
-- returns 401 "row-level security policy"). But relying solely on RLS
-- while the underlying grants stay wide open is exactly the kind of
-- redundant-but-fragile posture the rest of Phase 2 avoided by
-- revoking at the privilege level (belt AND suspenders) -- one
-- accidentally dropped/altered policy here and the bot token (and
-- hence the entire identity gateway) is directly readable/writable
-- by anyone with the public key.
--
-- set_app_setting() (SECURITY DEFINER, owned by postgres) is the only
-- legitimate write path and is unaffected by this revoke.
-- ============================================================

BEGIN;

REVOKE ALL ON public.app_settings FROM anon, authenticated;

COMMIT;
