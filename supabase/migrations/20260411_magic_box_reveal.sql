-- Add reveal_at for synchronized opening
ALTER TABLE public.magic_boxes ADD COLUMN IF NOT EXISTS reveal_at TIMESTAMPTZ;

-- Update open function: only allows ENTRY before reveal time, no prize shown
CREATE OR REPLACE FUNCTION public.open_magic_box(p_user_id UUID, p_box_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  v_box RECORD;
  v_user RECORD;
  v_already_entered BOOLEAN;
  v_entry_count INTEGER;
BEGIN
  SELECT * INTO v_box FROM public.magic_boxes WHERE id = p_box_id AND status = 'active';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Box not found or ended');
  END IF;

  IF v_box.expires_at IS NOT NULL AND v_box.expires_at < NOW() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Entry period has closed');
  END IF;

  SELECT * INTO v_user FROM public.users WHERE id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  IF v_box.allowed_usernames IS NOT NULL AND array_length(v_box.allowed_usernames, 1) > 0 THEN
    IF v_user.username IS NULL OR NOT (LOWER(v_user.username) = ANY(SELECT LOWER(unnest(v_box.allowed_usernames)))) THEN
      RETURN jsonb_build_object('success', false, 'error', 'You are not invited to this box');
    END IF;
  END IF;

  SELECT EXISTS(SELECT 1 FROM public.magic_box_entries WHERE box_id = p_box_id AND user_id = p_user_id) INTO v_already_entered;
  IF v_already_entered THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already entered');
  END IF;

  IF v_box.max_entries IS NOT NULL THEN
    SELECT COUNT(*) INTO v_entry_count FROM public.magic_box_entries WHERE box_id = p_box_id;
    IF v_entry_count >= v_box.max_entries THEN
      RETURN jsonb_build_object('success', false, 'error', 'Box is full');
    END IF;
  END IF;

  IF v_user.balance < v_box.entry_fee THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance. Need ' || v_box.entry_fee || ' DR');
  END IF;

  UPDATE public.users SET balance = balance - v_box.entry_fee WHERE id = p_user_id;
  INSERT INTO public.transactions (user_id, type, amount, description, reference_id)
  VALUES (p_user_id, 'bonus', -v_box.entry_fee, 'Magic Box entry: ' || v_box.title, v_box.id);
  PERFORM public.record_recycling(v_box.entry_fee);

  INSERT INTO public.magic_box_entries (box_id, user_id) VALUES (p_box_id, p_user_id);

  RETURN jsonb_build_object('success', true, 'entered', true, 'title', v_box.title, 'reveal_at', v_box.reveal_at);
END;
$func$;

-- Claim: only works AFTER reveal time
CREATE OR REPLACE FUNCTION public.claim_magic_box(p_user_id UUID, p_box_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  v_box RECORD;
  v_entry RECORD;
BEGIN
  SELECT * INTO v_box FROM public.magic_boxes WHERE id = p_box_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Box not found');
  END IF;

  IF v_box.reveal_at IS NOT NULL AND v_box.reveal_at > NOW() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Box has not been revealed yet');
  END IF;

  SELECT * INTO v_entry FROM public.magic_box_entries WHERE box_id = p_box_id AND user_id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'You have not entered this box');
  END IF;

  IF v_entry.claimed THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already claimed');
  END IF;

  IF v_box.prize_dr > 0 THEN
    UPDATE public.users SET balance = balance + v_box.prize_dr, total_earned = total_earned + v_box.prize_dr WHERE id = p_user_id;
    INSERT INTO public.transactions (user_id, type, amount, description, reference_id)
    VALUES (p_user_id, 'bonus', v_box.prize_dr, 'Magic Box prize: ' || v_box.title, v_box.id);
    PERFORM public.record_emission(v_box.prize_dr);
  END IF;

  UPDATE public.magic_box_entries SET claimed = TRUE, claimed_at = NOW() WHERE id = v_entry.id;

  RETURN jsonb_build_object('success', true, 'prize_dr', v_box.prize_dr, 'prize_xp', v_box.prize_xp);
END;
$func$;
