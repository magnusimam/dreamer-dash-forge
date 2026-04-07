-- Add birthday column to users
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS birthday DATE;
