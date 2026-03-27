-- Add is_super_admin flag to distinguish full admins from moderators
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN NOT NULL DEFAULT FALSE;

-- Set existing admins as super admins
UPDATE public.users SET is_super_admin = TRUE WHERE is_admin = TRUE;
