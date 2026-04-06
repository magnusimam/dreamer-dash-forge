-- Add status column to activities for manual end control
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
