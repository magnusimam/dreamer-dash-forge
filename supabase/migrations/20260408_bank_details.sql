-- Add bank details to users
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS bank_name TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS account_number TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS account_name TEXT;
