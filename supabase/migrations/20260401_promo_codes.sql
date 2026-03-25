-- Promo codes table for book promotions and future campaigns
CREATE TABLE public.promo_codes (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), code TEXT UNIQUE NOT NULL, reward INTEGER NOT NULL DEFAULT 500, description TEXT, is_used BOOLEAN NOT NULL DEFAULT FALSE, claimed_by UUID REFERENCES public.users(id) ON DELETE SET NULL, claimed_at TIMESTAMPTZ, created_by UUID, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());

ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view promo codes" ON public.promo_codes FOR SELECT USING (true);
CREATE POLICY "System can manage promo codes" ON public.promo_codes FOR ALL USING (true);
