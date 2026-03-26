-- Paid Monthly Missions: users pay DR to unlock, complete for reward

-- Add unlock_fee and completion_code to missions table
ALTER TABLE public.missions ADD COLUMN IF NOT EXISTS unlock_fee INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.missions ADD COLUMN IF NOT EXISTS completion_code TEXT;
ALTER TABLE public.missions ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Track who has unlocked which mission
CREATE TABLE IF NOT EXISTS public.mission_unlocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  mission_id UUID NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, mission_id)
);

ALTER TABLE public.mission_unlocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view mission unlocks" ON public.mission_unlocks FOR SELECT USING (true);
CREATE POLICY "System can manage mission unlocks" ON public.mission_unlocks FOR ALL USING (true);
