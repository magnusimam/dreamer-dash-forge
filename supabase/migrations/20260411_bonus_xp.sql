-- Track bonus XP awards (from magic boxes, etc.)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS bonus_xp INTEGER NOT NULL DEFAULT 0;
