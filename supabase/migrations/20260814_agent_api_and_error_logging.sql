-- ============================================================
-- AGENT API — ERROR LOGGING
-- ------------------------------------------------------------
-- Backs the new `agent-api` edge function (supabase/functions/agent-api),
-- a separate, bearer-key-authenticated, read-only HTTP API for external
-- tooling (not the Telegram Mini App) to query the platform — including
-- app errors, which had no structured record anywhere before this.
--
-- app_errors has NO anon/authenticated policies: the only insert path is
-- log_client_error() below, and the only read path is agent-api's
-- service-role client (which bypasses RLS entirely).
-- ============================================================

BEGIN;

CREATE TABLE public.app_errors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  telegram_id BIGINT,
  source TEXT NOT NULL CHECK (source IN
    ('frontend_render', 'frontend_query', 'frontend_mutation', 'frontend_unhandled')),
  context TEXT,
  message TEXT NOT NULL,
  stack TEXT,
  metadata JSONB
);
ALTER TABLE public.app_errors ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- log_client_error: unlike every other RPC, this must NEVER raise on
-- bad/missing initData — a broken identity is often exactly what's
-- being reported. Best-effort resolves the caller; falls back to an
-- anonymous row rather than failing the log call itself.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_client_error(
  p_init_data TEXT,
  p_source TEXT,
  p_context TEXT DEFAULT NULL,
  p_message TEXT DEFAULT NULL,
  p_stack TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user public.users;
BEGIN
  IF p_source NOT IN ('frontend_render', 'frontend_query', 'frontend_mutation', 'frontend_unhandled') THEN
    p_source := 'frontend_unhandled';
  END IF;

  BEGIN
    v_user := public.app_user(p_init_data);
  EXCEPTION WHEN OTHERS THEN
    v_user := NULL;
  END;

  INSERT INTO public.app_errors (user_id, telegram_id, source, context, message, stack, metadata)
  VALUES (
    v_user.id,
    v_user.telegram_id,
    p_source,
    left(p_context, 500),
    left(COALESCE(p_message, 'unknown error'), 2000),
    left(p_stack, 4000),
    p_metadata
  );
EXCEPTION WHEN OTHERS THEN
  -- Logging must never itself break the app it's reporting on.
  NULL;
END;
$$;
GRANT EXECUTE ON FUNCTION public.log_client_error(TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) TO anon, authenticated;

COMMIT;
