-- Weekly MVP tracking
CREATE TABLE IF NOT EXISTS public.weekly_mvps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  engagement_points INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(week_start)
);

ALTER TABLE public.weekly_mvps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view weekly mvps" ON public.weekly_mvps FOR SELECT USING (true);
CREATE POLICY "System can manage weekly mvps" ON public.weekly_mvps FOR ALL USING (true);

-- Featured dreamer (spotlight) tracking
CREATE TABLE IF NOT EXISTS public.featured_dreamers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(week_start)
);

ALTER TABLE public.featured_dreamers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view featured dreamers" ON public.featured_dreamers FOR SELECT USING (true);
CREATE POLICY "System can manage featured dreamers" ON public.featured_dreamers FOR ALL USING (true);
