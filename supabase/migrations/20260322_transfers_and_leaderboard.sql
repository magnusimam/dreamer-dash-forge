-- ============================================================
-- 1. TRANSFER FEATURE
-- ============================================================

-- Add 'transfer' to transaction type check
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_type_check;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_type_check
  CHECK (type IN ('earn', 'redeem', 'mission', 'bonus', 'checkin', 'hackathon_fee', 'hackathon_prize', 'transfer_out', 'transfer_in'));

-- Transfer DR between users
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
  v_fee INTEGER := 0;
  v_total_deduct INTEGER;
BEGIN
  -- Validate amount
  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount must be positive');
  END IF;

  IF p_amount < 10 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Minimum transfer is 10 DR');
  END IF;

  -- Get sender
  SELECT * INTO v_sender FROM public.users WHERE id = p_sender_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sender not found');
  END IF;

  -- Find recipient by username (case-insensitive)
  SELECT * INTO v_recipient FROM public.users WHERE LOWER(username) = LOWER(p_recipient_username);
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Recipient not found. Check the username.');
  END IF;

  -- Cannot send to self
  IF v_sender.id = v_recipient.id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot transfer to yourself');
  END IF;

  -- Calculate total (amount + fee)
  v_total_deduct := p_amount + v_fee;

  -- Check balance
  IF v_sender.balance < v_total_deduct THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance');
  END IF;

  -- Deduct from sender
  UPDATE public.users SET balance = balance - v_total_deduct WHERE id = v_sender.id;

  -- Credit recipient
  UPDATE public.users SET balance = balance + p_amount WHERE id = v_recipient.id;

  -- Record sender transaction
  INSERT INTO public.transactions (user_id, type, amount, description)
  VALUES (
    v_sender.id, 'transfer_out', -p_amount,
    'Transfer to @' || v_recipient.username || COALESCE(': ' || p_note, '')
  );

  -- Record recipient transaction
  INSERT INTO public.transactions (user_id, type, amount, description)
  VALUES (
    v_recipient.id, 'transfer_in', p_amount,
    'Transfer from @' || COALESCE(v_sender.username, v_sender.first_name) || COALESCE(': ' || p_note, '')
  );

  RETURN jsonb_build_object(
    'success', true,
    'amount', p_amount,
    'recipient', v_recipient.first_name,
    'recipient_username', v_recipient.username
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 2. LEADERBOARD VIEW
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_leaderboard(p_limit INTEGER DEFAULT 20)
RETURNS TABLE (
  user_id UUID,
  first_name TEXT,
  last_name TEXT,
  username TEXT,
  photo_url TEXT,
  total_earned INTEGER,
  balance INTEGER,
  streak INTEGER,
  status TEXT,
  rank BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id AS user_id,
    u.first_name,
    u.last_name,
    u.username,
    u.photo_url,
    u.total_earned,
    u.balance,
    u.streak,
    u.status,
    ROW_NUMBER() OVER (ORDER BY u.balance DESC) AS rank
  FROM public.users u
  ORDER BY u.balance DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 3. TELEGRAM INITDATA VALIDATION HELPER
-- Store bot token hash for server-side validation
-- ============================================================

CREATE TABLE IF NOT EXISTS public.app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- No direct access to app_settings from client
CREATE POLICY "No client access to app_settings"
  ON public.app_settings FOR SELECT
  USING (false);

-- Validate Telegram initData server-side
-- This function checks the hash using pgcrypto
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.validate_telegram_init_data(
  p_init_data TEXT,
  p_bot_token TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_data_pairs TEXT[];
  v_hash TEXT;
  v_data_check_string TEXT;
  v_secret_key BYTEA;
  v_computed_hash TEXT;
  v_pair TEXT;
  v_sorted_pairs TEXT[];
  v_key TEXT;
  v_value TEXT;
  v_user_json JSONB;
BEGIN
  -- Parse the init data (URL-encoded key=value pairs separated by &)
  v_data_pairs := string_to_array(p_init_data, '&');

  -- Extract hash and build data-check-string
  v_sorted_pairs := ARRAY[]::TEXT[];

  FOREACH v_pair IN ARRAY v_data_pairs LOOP
    v_key := split_part(v_pair, '=', 1);
    v_value := substr(v_pair, length(v_key) + 2);

    IF v_key = 'hash' THEN
      v_hash := v_value;
    ELSE
      v_sorted_pairs := array_append(v_sorted_pairs, v_pair);
    END IF;
  END LOOP;

  IF v_hash IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'error', 'No hash found');
  END IF;

  -- Sort pairs alphabetically
  SELECT array_agg(s ORDER BY s) INTO v_sorted_pairs FROM unnest(v_sorted_pairs) AS s;

  -- Build data-check-string
  v_data_check_string := array_to_string(v_sorted_pairs, E'\n');

  -- Compute HMAC
  v_secret_key := hmac(p_bot_token::bytea, 'WebAppData'::bytea, 'sha256');
  v_computed_hash := encode(hmac(v_data_check_string::bytea, v_secret_key, 'sha256'), 'hex');

  IF v_computed_hash = v_hash THEN
    RETURN jsonb_build_object('valid', true);
  ELSE
    RETURN jsonb_build_object('valid', false, 'error', 'Invalid hash');
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
