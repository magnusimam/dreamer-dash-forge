-- ============================================================
-- PHASE 2D — BANK PII READ HARDENING
-- ------------------------------------------------------------
-- Bank details were world-readable: `users` SELECT is USING(true)
-- and the client read them via select('*') / a profile query, so
-- anyone with the anon key (or opening any user's profile) could see
-- everyone's bank_name / account_number / account_name.
--
-- Fix: revoke SELECT on those three columns from the client roles
-- (column-level privilege). The owner still reads their own full row
-- through the SECURITY DEFINER get_me() function below (runs as owner,
-- which retains column access). No other code path returns another
-- user's bank columns after the companion frontend change.
--
-- Note: telegram_id and birthday remain readable (used widely for
-- notifications / birthday features) — tracked as residual.
-- ============================================================

BEGIN;

REVOKE SELECT (bank_name, account_number, account_name) ON public.users FROM anon, authenticated;

-- Owner reads their own full row (incl. bank) via the verified gateway.
CREATE OR REPLACE FUNCTION public.get_me(p_init_data TEXT)
RETURNS public.users
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RETURN public.app_user(p_init_data);
END; $$;
GRANT EXECUTE ON FUNCTION public.get_me(TEXT) TO anon, authenticated;

COMMIT;
