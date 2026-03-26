-- Add last_active column for online status tracking
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_active TIMESTAMPTZ;
