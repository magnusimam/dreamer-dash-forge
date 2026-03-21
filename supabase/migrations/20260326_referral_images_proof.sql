-- ============================================================
-- 1. AUTO REFERRAL CODE ON SIGNUP
-- ============================================================

CREATE OR REPLACE FUNCTION public.upsert_telegram_user(
  p_telegram_id BIGINT,
  p_first_name TEXT,
  p_last_name TEXT DEFAULT NULL,
  p_username TEXT DEFAULT NULL,
  p_photo_url TEXT DEFAULT NULL,
  p_language_code TEXT DEFAULT 'en'
)
RETURNS public.users AS $$
DECLARE
  v_user public.users;
  v_code TEXT;
BEGIN
  -- Generate referral code from telegram_id
  v_code := 'DR-' || UPPER(SUBSTRING(MD5(p_telegram_id::TEXT), 1, 8));

  INSERT INTO public.users (telegram_id, first_name, last_name, username, photo_url, language_code, referral_code)
  VALUES (p_telegram_id, p_first_name, p_last_name, p_username, p_photo_url, p_language_code, v_code)
  ON CONFLICT (telegram_id) DO UPDATE SET
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    username = EXCLUDED.username,
    photo_url = EXCLUDED.photo_url,
    language_code = EXCLUDED.language_code,
    referral_code = COALESCE(public.users.referral_code, v_code),
    updated_at = NOW()
  RETURNING * INTO v_user;

  RETURN v_user;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Backfill referral codes for existing users without one
UPDATE public.users
SET referral_code = 'DR-' || UPPER(SUBSTRING(MD5(telegram_id::TEXT), 1, 8))
WHERE referral_code IS NULL;

-- ============================================================
-- 2. HACKATHON COVER IMAGES
-- ============================================================

ALTER TABLE public.hackathons ADD COLUMN IF NOT EXISTS cover_image_url TEXT;

-- ============================================================
-- 3. ACTIVITY PROOF SYSTEM
-- ============================================================

-- Activities can require code, proof (image), or both
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS proof_required BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS code_required BOOLEAN NOT NULL DEFAULT TRUE;

-- Activity logs can have proof images
ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS proof_image_url TEXT;
ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS proof_status TEXT NOT NULL DEFAULT 'pending'
  CHECK (proof_status IN ('pending', 'approved', 'rejected', 'not_required'));

-- Mission proof support
ALTER TABLE public.mission_completions ADD COLUMN IF NOT EXISTS proof_image_url TEXT;
ALTER TABLE public.mission_completions ADD COLUMN IF NOT EXISTS proof_status TEXT NOT NULL DEFAULT 'not_required'
  CHECK (proof_status IN ('pending', 'approved', 'rejected', 'not_required'));

-- Update existing activity_logs to not_required
UPDATE public.activity_logs SET proof_status = 'not_required' WHERE proof_status = 'pending';

-- ============================================================
-- FUNCTION: Log activity with optional proof
-- ============================================================

CREATE OR REPLACE FUNCTION public.log_activity(p_user_id UUID, p_code TEXT, p_proof_url TEXT DEFAULT NULL)
RETURNS JSONB AS $$
DECLARE
  v_activity public.activities;
  v_user public.users;
  v_already_logged BOOLEAN;
  v_multiplier NUMERIC;
  v_reward INTEGER;
  v_proof_status TEXT;
BEGIN
  -- Try to find by code first
  IF p_code IS NOT NULL AND p_code != '' THEN
    SELECT * INTO v_activity FROM public.activities
    WHERE code = p_code AND is_active = TRUE;
  END IF;

  IF NOT FOUND AND p_proof_url IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid activity code');
  END IF;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid activity code');
  END IF;

  SELECT * INTO v_user FROM public.users WHERE id = p_user_id;

  SELECT EXISTS(
    SELECT 1 FROM public.activity_logs WHERE user_id = p_user_id AND activity_id = v_activity.id
  ) INTO v_already_logged;

  IF v_already_logged THEN
    RETURN jsonb_build_object('success', false, 'error', 'Activity already logged');
  END IF;

  IF v_activity.max_participants IS NOT NULL THEN
    IF (SELECT COUNT(*) FROM public.activity_logs WHERE activity_id = v_activity.id) >= v_activity.max_participants THEN
      RETURN jsonb_build_object('success', false, 'error', 'Activity is full');
    END IF;
  END IF;

  -- Check if proof is required but not provided
  IF v_activity.proof_required AND (p_proof_url IS NULL OR p_proof_url = '') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Proof of activity is required');
  END IF;

  -- Determine proof status
  IF v_activity.proof_required THEN
    v_proof_status := 'pending'; -- needs admin approval
  ELSE
    v_proof_status := 'not_required';
  END IF;

  v_multiplier := public.get_earning_multiplier(v_user.balance);
  v_reward := GREATEST(FLOOR(v_activity.reward * v_multiplier)::INTEGER, 0);

  IF v_reward = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet cap reached.');
  END IF;

  IF NOT public.can_emit(v_reward) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Daily distribution limit reached.');
  END IF;

  -- Log the activity
  INSERT INTO public.activity_logs (user_id, activity_id, proof_image_url, proof_status)
  VALUES (p_user_id, v_activity.id, p_proof_url, v_proof_status);

  -- If proof required, don't give reward yet (admin must approve)
  IF v_activity.proof_required THEN
    RETURN jsonb_build_object(
      'success', true,
      'reward', 0,
      'activity', v_activity.title,
      'pending_approval', true,
      'message', 'Proof submitted! Reward will be credited after admin approval.'
    );
  END IF;

  -- Give reward immediately (code-only activities)
  UPDATE public.users SET
    balance = balance + v_reward,
    total_earned = total_earned + v_reward
  WHERE id = p_user_id;

  INSERT INTO public.transactions (user_id, type, amount, description, reference_id)
  VALUES (p_user_id, 'earn', v_reward, v_activity.title, v_activity.id);

  PERFORM public.record_emission(v_reward);

  RETURN jsonb_build_object('success', true, 'reward', v_reward, 'activity', v_activity.title);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- FUNCTION: Admin approve/reject activity proof
-- ============================================================

CREATE OR REPLACE FUNCTION public.process_activity_proof(
  p_admin_id UUID,
  p_log_id UUID,
  p_action TEXT -- 'approved' or 'rejected'
)
RETURNS JSONB AS $$
DECLARE
  v_admin public.users;
  v_log public.activity_logs;
  v_activity public.activities;
  v_user public.users;
  v_multiplier NUMERIC;
  v_reward INTEGER;
BEGIN
  SELECT * INTO v_admin FROM public.users WHERE id = p_admin_id AND is_admin = TRUE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;

  SELECT * INTO v_log FROM public.activity_logs WHERE id = p_log_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Activity log not found');
  END IF;

  IF v_log.proof_status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already processed');
  END IF;

  -- Update proof status
  UPDATE public.activity_logs SET proof_status = p_action WHERE id = p_log_id;

  IF p_action = 'approved' THEN
    SELECT * INTO v_activity FROM public.activities WHERE id = v_log.activity_id;
    SELECT * INTO v_user FROM public.users WHERE id = v_log.user_id;

    v_multiplier := public.get_earning_multiplier(v_user.balance);
    v_reward := GREATEST(FLOOR(v_activity.reward * v_multiplier)::INTEGER, 0);

    IF v_reward > 0 AND public.can_emit(v_reward) THEN
      UPDATE public.users SET
        balance = balance + v_reward,
        total_earned = total_earned + v_reward
      WHERE id = v_log.user_id;

      INSERT INTO public.transactions (user_id, type, amount, description, reference_id)
      VALUES (v_log.user_id, 'earn', v_reward, v_activity.title || ' (proof approved)', v_activity.id);

      PERFORM public.record_emission(v_reward);
    END IF;

    RETURN jsonb_build_object('success', true, 'action', 'approved', 'reward', v_reward);
  END IF;

  RETURN jsonb_build_object('success', true, 'action', 'rejected');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- STORAGE BUCKETS (create via API, not SQL)
-- Note: Storage buckets must be created via Supabase dashboard
-- or API. Create two public buckets:
-- 1. "hackathon-covers" - for hackathon cover images
-- 2. "activity-proofs" - for activity proof uploads
-- ============================================================
