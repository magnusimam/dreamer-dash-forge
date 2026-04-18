-- Add daily transaction limits per tier
-- Bronze: 5/day, Silver: 10/day, Gold: 20/day, Diamond: Unlimited
CREATE OR REPLACE FUNCTION public.transfer_dr(p_sender_id UUID, p_recipient_username TEXT, p_amount INTEGER, p_note TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  v_sender RECORD;
  v_recipient RECORD;
  v_fee INTEGER;
  v_total_deduct INTEGER;
  v_today_transfers INTEGER;
  v_daily_limit INTEGER;
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

  -- Check daily transaction limit by tier
  IF v_sender.status = 'Diamond' THEN
    v_daily_limit := 999999; -- unlimited
  ELSIF v_sender.status = 'Gold' THEN
    v_daily_limit := 20;
  ELSIF v_sender.status = 'Silver' THEN
    v_daily_limit := 10;
  ELSE
    v_daily_limit := 5; -- Bronze
  END IF;

  SELECT COUNT(*) INTO v_today_transfers
  FROM public.transactions
  WHERE user_id = p_sender_id
    AND type = 'transfer_out'
    AND created_at::DATE = CURRENT_DATE;

  IF v_today_transfers >= v_daily_limit THEN
    RETURN jsonb_build_object('success', false, 'error',
      'Daily transfer limit reached (' || v_daily_limit || '/day for ' || v_sender.status || '). Upgrade your tier to send more!');
  END IF;

  -- Try matching by username first (case-insensitive, skip NULLs)
  SELECT * INTO v_recipient FROM public.users
  WHERE username IS NOT NULL AND LOWER(username) = LOWER(p_recipient_username);

  -- Fall back to first_name match
  IF NOT FOUND THEN
    SELECT * INTO v_recipient FROM public.users
    WHERE LOWER(first_name) = LOWER(p_recipient_username);

    IF FOUND THEN
      DECLARE
        v_count INTEGER;
      BEGIN
        SELECT COUNT(*) INTO v_count FROM public.users
        WHERE LOWER(first_name) = LOWER(p_recipient_username);
        IF v_count > 1 THEN
          RETURN jsonb_build_object('success', false, 'error',
            'Multiple users found with that name. Ask the recipient for their Telegram username.');
        END IF;
      END;
    END IF;
  END IF;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Recipient not found. Check the username or name.');
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
    'Transfer to ' || COALESCE('@' || v_recipient.username, v_recipient.first_name) || ' (' || v_fee || ' DR fee)' || COALESCE(': ' || p_note, ''));

  INSERT INTO public.transactions (user_id, type, amount, description)
  VALUES (v_recipient.id, 'transfer_in', p_amount,
    'Transfer from ' || COALESCE('@' || v_sender.username, v_sender.first_name) || COALESCE(': ' || p_note, ''));

  PERFORM public.record_recycling(v_fee);

  RETURN jsonb_build_object('success', true, 'amount', p_amount, 'fee', v_fee,
    'recipient', v_recipient.first_name,
    'recipient_username', COALESCE(v_recipient.username, v_recipient.first_name));
END;
$func$;
