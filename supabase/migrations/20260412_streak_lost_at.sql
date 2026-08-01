-- Track when streak was lost so we can expire the restore window
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS streak_lost_at TIMESTAMPTZ;
