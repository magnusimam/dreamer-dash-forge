-- ============================================================
-- Admin: un-archive (reactivate) a raffle. Counterpart to
-- admin_deactivate_raffle. Lets admins bring an archived raffle
-- back into the user-facing list.
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.admin_reactivate_raffle(p_init_data TEXT, p_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM public.app_admin(p_init_data);
  UPDATE public.raffles SET is_active = TRUE WHERE id = p_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_reactivate_raffle(TEXT, UUID) TO anon, authenticated;

COMMIT;
