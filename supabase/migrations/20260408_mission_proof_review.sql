-- Add proof and approval fields to mission_completions
ALTER TABLE public.mission_completions ADD COLUMN IF NOT EXISTS proof_url TEXT;
ALTER TABLE public.mission_completions ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'approved';
ALTER TABLE public.mission_completions ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

-- Allow updates on mission_completions
CREATE POLICY "System can update mission completions" ON public.mission_completions FOR UPDATE USING (true);
