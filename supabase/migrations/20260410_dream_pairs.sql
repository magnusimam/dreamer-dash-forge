-- Dream Pairs system

CREATE TABLE IF NOT EXISTS public.dream_pairs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user1_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  user2_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended')),
  rating_from_1 INTEGER CHECK (rating_from_1 BETWEEN 1 AND 5),
  rating_from_2 INTEGER CHECK (rating_from_2 BETWEEN 1 AND 5),
  comment_from_1 TEXT,
  comment_from_2 TEXT,
  user1_checked_for_2 BOOLEAN NOT NULL DEFAULT FALSE,
  user2_checked_for_1 BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dream_pairs_user1 ON public.dream_pairs(user1_id, status);
CREATE INDEX IF NOT EXISTS idx_dream_pairs_user2 ON public.dream_pairs(user2_id, status);

CREATE TABLE IF NOT EXISTS public.pair_queue (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.pair_pokes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pair_id UUID NOT NULL REFERENCES public.dream_pairs(id) ON DELETE CASCADE,
  from_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  to_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.dream_pairs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pair_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pair_pokes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view pairs" ON public.dream_pairs FOR SELECT USING (true);
CREATE POLICY "System can manage pairs" ON public.dream_pairs FOR ALL USING (true);
CREATE POLICY "Anyone can view queue" ON public.pair_queue FOR SELECT USING (true);
CREATE POLICY "System can manage queue" ON public.pair_queue FOR ALL USING (true);
CREATE POLICY "Anyone can view pokes" ON public.pair_pokes FOR SELECT USING (true);
CREATE POLICY "System can manage pokes" ON public.pair_pokes FOR ALL USING (true);
