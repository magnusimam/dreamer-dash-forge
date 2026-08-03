-- Admin-controlled ads/banners system, replacing the hardcoded "The Stolen
-- Breath" promo banner in ActivityLog. Admin creates/edits/toggles/deletes
-- ads entirely from the admin panel; the frontend shows up to 2 active ads
-- at a time as a rotating slider (see useActiveAds()/AdsSection in the app).

CREATE TABLE IF NOT EXISTS public.ads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  cta_label TEXT NOT NULL DEFAULT '',
  cta_url TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.ads ENABLE ROW LEVEL SECURITY;

-- Anyone can read ads (admin panel needs inactive ones too for management;
-- the app only queries is_active = true). No INSERT/UPDATE/DELETE policies —
-- all writes go through the admin_* RPCs below.
CREATE POLICY "Anyone can view ads"
  ON public.ads FOR SELECT
  USING (true);

REVOKE INSERT, UPDATE, DELETE ON public.ads FROM anon, authenticated;
GRANT SELECT ON public.ads TO anon, authenticated;

-- ============================================================
-- ADS (admin)
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_create_ad(
  p_init_data TEXT, p_title TEXT, p_body TEXT DEFAULT '', p_cta_label TEXT DEFAULT '',
  p_cta_url TEXT DEFAULT '', p_display_order INTEGER DEFAULT 0)
RETURNS public.ads LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_row public.ads;
BEGIN
  PERFORM public.app_admin(p_init_data);
  INSERT INTO public.ads (title, body, cta_label, cta_url, display_order)
  VALUES (p_title, COALESCE(p_body, ''), COALESCE(p_cta_label, ''), COALESCE(p_cta_url, ''), COALESCE(p_display_order, 0))
  RETURNING * INTO v_row;
  RETURN v_row;
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_create_ad(TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_update_ad(
  p_init_data TEXT, p_id UUID, p_title TEXT DEFAULT NULL, p_body TEXT DEFAULT NULL,
  p_cta_label TEXT DEFAULT NULL, p_cta_url TEXT DEFAULT NULL, p_is_active BOOLEAN DEFAULT NULL,
  p_display_order INTEGER DEFAULT NULL)
RETURNS public.ads LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_row public.ads;
BEGIN
  PERFORM public.app_admin(p_init_data);
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
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_update_ad(TEXT, UUID, TEXT, TEXT, TEXT, TEXT, BOOLEAN, INTEGER) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_delete_ad(p_init_data TEXT, p_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM public.app_admin(p_init_data);
  DELETE FROM public.ads WHERE id = p_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_delete_ad(TEXT, UUID) TO anon, authenticated;
