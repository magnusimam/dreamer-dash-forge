-- Update minimum transfer from 10 DR to 5 DR
CREATE OR REPLACE FUNCTION public.transfer_dr(
  p_sender_id UUID,
  p_recipient_username TEXT,
  p_amount INTEGER,
  p_note TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_sender public.users;
  v_recipient public.users;
  v_fee INTEGER;
  v_total_deduct INTEGER;
BEGIN
  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount must be positive');
  END IF;

  IF p_amount < 5 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Minimum transfer is 5 DR');
  END IF;

  SELECT * INTO v_sender FROM public.users WHERE id = p_sender_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sender not found');
  END IF;

  SELECT * INTO v_recipient FROM public.users WHERE LOWER(username) = LOWER(p_recipient_username);
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Recipient not found. Check the username.');
  END IF;

  IF v_sender.id = v_recipient.id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot transfer to yourself');
  END IF;

  IF v_recipient.balance + p_amount > 50000 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Recipient wallet cap would be exceeded');
  END IF;

  v_fee := GREATEST(FLOOR(p_amount * 0.02)::INTEGER, 1);
  v_total_deduct := p_amount + v_fee;

  IF v_sender.balance < v_total_deduct THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance (amount + 2% fee)');
  END IF;

  UPDATE public.users SET balance = balance - v_total_deduct WHERE id = v_sender.id;
  UPDATE public.users SET balance = balance + p_amount WHERE id = v_recipient.id;

  INSERT INTO public.transactions (user_id, type, amount, description)
  VALUES (v_sender.id, 'transfer_out', -v_total_deduct,
    'Transfer to @' || v_recipient.username || ' (' || v_fee || ' DR fee)' || COALESCE(': ' || p_note, ''));

  INSERT INTO public.transactions (user_id, type, amount, description)
  VALUES (v_recipient.id, 'transfer_in', p_amount,
    'Transfer from @' || COALESCE(v_sender.username, v_sender.first_name) || COALESCE(': ' || p_note, ''));

  PERFORM public.record_recycling(v_fee);

  RETURN jsonb_build_object('success', true, 'amount', p_amount, 'fee', v_fee,
    'recipient', v_recipient.first_name, 'recipient_username', v_recipient.username);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
