-- ============================================================
-- Admin: delete a promo code (gated on verified admin).
-- Lets admins remove a promo code so it can no longer be claimed.
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.admin_delete_promo_code(p_init_data TEXT, p_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM public.app_admin(p_init_data);
  DELETE FROM public.promo_codes WHERE id = p_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_delete_promo_code(TEXT, UUID) TO anon, authenticated;

COMMIT;
