-- 20260407_inactivity_penalty.sql added this column, but it was apparently
-- never actually applied to the live DB (this project's remote migration
-- ledger predates the current db-query-based workflow and has gaps like
-- this). apply_inactivity_penalty() reads/writes this column on every call,
-- and the Admin panel's Users/Referrals tabs select it directly — both were
-- silently failing without it. Re-running the original DDL; IF NOT EXISTS
-- makes this safe regardless of whether it was secretly already applied.

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_penalty_date DATE;
