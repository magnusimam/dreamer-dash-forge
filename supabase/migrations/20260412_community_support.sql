-- Community Support system

CREATE TABLE IF NOT EXISTS public.support_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  beneficiary_name TEXT NOT NULL,
  beneficiary_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  target_amount INTEGER NOT NULL,
  bank_name TEXT,
  account_number TEXT,
  account_name TEXT,
  dr_reward_per_1000 INTEGER NOT NULL DEFAULT 50,
  xp_reward_per_1000 INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'ended')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.support_contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.support_campaigns(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  proof_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  dr_earned INTEGER NOT NULL DEFAULT 0,
  xp_earned INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);

ALTER TABLE public.support_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_contributions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view support campaigns" ON public.support_campaigns FOR SELECT USING (true);
CREATE POLICY "System can manage support campaigns" ON public.support_campaigns FOR ALL USING (true);
CREATE POLICY "Anyone can view support contributions" ON public.support_contributions FOR SELECT USING (true);
CREATE POLICY "System can manage support contributions" ON public.support_contributions FOR ALL USING (true);

-- Submit a contribution
CREATE OR REPLACE FUNCTION public.submit_contribution(p_user_id UUID, p_campaign_id UUID, p_amount INTEGER, p_proof_url TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  v_campaign RECORD;
  v_user RECORD;
BEGIN
  SELECT * INTO v_campaign FROM public.support_campaigns WHERE id = p_campaign_id AND is_active = TRUE AND status = 'active';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Campaign not found or ended');
  END IF;

  SELECT * INTO v_user FROM public.users WHERE id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount must be positive');
  END IF;

  INSERT INTO public.support_contributions (campaign_id, user_id, amount, proof_url)
  VALUES (p_campaign_id, p_user_id, p_amount, p_proof_url);

  RETURN jsonb_build_object('success', true, 'campaign', v_campaign.title, 'amount', p_amount);
END;
$func$;

-- Admin approve contribution
CREATE OR REPLACE FUNCTION public.approve_contribution(p_admin_id UUID, p_contribution_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  v_admin RECORD;
  v_contrib RECORD;
  v_campaign RECORD;
  v_dr_reward INTEGER;
  v_xp_reward INTEGER;
BEGIN
  SELECT * INTO v_admin FROM public.users WHERE id = p_admin_id AND is_admin = TRUE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;

  SELECT * INTO v_contrib FROM public.support_contributions WHERE id = p_contribution_id AND status = 'pending';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Contribution not found or already reviewed');
  END IF;

  SELECT * INTO v_campaign FROM public.support_campaigns WHERE id = v_contrib.campaign_id;

  -- Calculate rewards based on amount contributed
  v_dr_reward := GREATEST(FLOOR(v_contrib.amount::NUMERIC / 1000 * v_campaign.dr_reward_per_1000)::INTEGER, v_campaign.dr_reward_per_1000);
  v_xp_reward := GREATEST(FLOOR(v_contrib.amount::NUMERIC / 1000 * v_campaign.xp_reward_per_1000)::INTEGER, v_campaign.xp_reward_per_1000);

  -- Update contribution
  UPDATE public.support_contributions SET status = 'approved', dr_earned = v_dr_reward, xp_earned = v_xp_reward, reviewed_at = NOW() WHERE id = p_contribution_id;

  -- Award DR
  IF v_dr_reward > 0 THEN
    UPDATE public.users SET balance = balance + v_dr_reward, total_earned = total_earned + v_dr_reward WHERE id = v_contrib.user_id;
    INSERT INTO public.transactions (user_id, type, amount, description, reference_id)
    VALUES (v_contrib.user_id, 'bonus', v_dr_reward, 'Community Support: ' || v_campaign.title || ' (₦' || v_contrib.amount || ')', v_campaign.id);
    PERFORM public.record_emission(v_dr_reward);
  END IF;

  -- Award XP
  IF v_xp_reward > 0 THEN
    UPDATE public.users SET bonus_xp = bonus_xp + v_xp_reward WHERE id = v_contrib.user_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'dr_reward', v_dr_reward, 'xp_reward', v_xp_reward, 'user_id', v_contrib.user_id, 'campaign', v_campaign.title);
END;
$func$;

-- Admin reject contribution
CREATE OR REPLACE FUNCTION public.reject_contribution(p_admin_id UUID, p_contribution_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  v_admin RECORD;
BEGIN
  SELECT * INTO v_admin FROM public.users WHERE id = p_admin_id AND is_admin = TRUE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;

  DELETE FROM public.support_contributions WHERE id = p_contribution_id AND status = 'pending';

  RETURN jsonb_build_object('success', true);
END;
$func$;
