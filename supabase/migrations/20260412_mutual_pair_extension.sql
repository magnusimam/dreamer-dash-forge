-- Add extension tracking to dream pairs
ALTER TABLE public.dream_pairs ADD COLUMN IF NOT EXISTS extension_requested_by UUID REFERENCES public.users(id);
ALTER TABLE public.dream_pairs ADD COLUMN IF NOT EXISTS extension_status TEXT CHECK (extension_status IN ('pending', 'accepted', 'denied'));

-- Request extension (doesn't deduct DR yet)
CREATE OR REPLACE FUNCTION public.request_pair_extension(p_user_id UUID, p_pair_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  v_pair RECORD;
BEGIN
  SELECT * INTO v_pair FROM public.dream_pairs WHERE id = p_pair_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pair not found');
  END IF;

  IF v_pair.user1_id != p_user_id AND v_pair.user2_id != p_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not part of this pair');
  END IF;

  IF v_pair.extension_requested_by IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Extension already requested');
  END IF;

  UPDATE public.dream_pairs SET extension_requested_by = p_user_id, extension_status = 'pending' WHERE id = p_pair_id;

  RETURN jsonb_build_object('success', true);
END;
$func$;

-- Accept extension (both pay 100 DR, new pair created for next week)
CREATE OR REPLACE FUNCTION public.accept_pair_extension(p_user_id UUID, p_pair_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  v_pair RECORD;
  v_user1 RECORD;
  v_user2 RECORD;
  v_cost INTEGER := 100;
  v_today DATE := CURRENT_DATE;
  v_dow INTEGER;
  v_next_week_start DATE;
  v_next_week_end DATE;
BEGIN
  SELECT * INTO v_pair FROM public.dream_pairs WHERE id = p_pair_id AND extension_status = 'pending';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'No pending extension');
  END IF;

  -- The accepter must be the OTHER person (not the requester)
  IF v_pair.extension_requested_by = p_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'You requested the extension. Wait for your pair to accept.');
  END IF;

  IF v_pair.user1_id != p_user_id AND v_pair.user2_id != p_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not part of this pair');
  END IF;

  SELECT * INTO v_user1 FROM public.users WHERE id = v_pair.user1_id;
  SELECT * INTO v_user2 FROM public.users WHERE id = v_pair.user2_id;

  IF v_user1.balance < v_cost OR v_user2.balance < v_cost THEN
    RETURN jsonb_build_object('success', false, 'error', 'Both pairs need at least ' || v_cost || ' DR');
  END IF;

  v_dow := EXTRACT(DOW FROM v_today);
  v_next_week_start := v_today - ((v_dow + 6) % 7) * INTERVAL '1 day' + INTERVAL '7 days';
  v_next_week_end := v_next_week_start + INTERVAL '6 days';

  IF EXISTS(SELECT 1 FROM public.dream_pairs WHERE user1_id = v_pair.user1_id AND user2_id = v_pair.user2_id AND week_start = v_next_week_start) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already extended');
  END IF;

  -- Deduct from both
  UPDATE public.users SET balance = balance - v_cost WHERE id IN (v_pair.user1_id, v_pair.user2_id);
  INSERT INTO public.transactions (user_id, type, amount, description) VALUES
    (v_pair.user1_id, 'bonus', -v_cost, 'Dream Pair extension fee'),
    (v_pair.user2_id, 'bonus', -v_cost, 'Dream Pair extension fee');
  PERFORM public.record_recycling(v_cost * 2);

  -- Create next week pair
  INSERT INTO public.dream_pairs (user1_id, user2_id, week_start, week_end)
  VALUES (v_pair.user1_id, v_pair.user2_id, v_next_week_start, v_next_week_end);

  -- Mark as accepted
  UPDATE public.dream_pairs SET extension_status = 'accepted' WHERE id = p_pair_id;

  RETURN jsonb_build_object('success', true);
END;
$func$;

-- Deny extension
CREATE OR REPLACE FUNCTION public.deny_pair_extension(p_user_id UUID, p_pair_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  v_pair RECORD;
BEGIN
  SELECT * INTO v_pair FROM public.dream_pairs WHERE id = p_pair_id AND extension_status = 'pending';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'No pending extension');
  END IF;

  IF v_pair.extension_requested_by = p_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'You cannot deny your own request');
  END IF;

  UPDATE public.dream_pairs SET extension_status = 'denied' WHERE id = p_pair_id;

  RETURN jsonb_build_object('success', true);
END;
$func$;
