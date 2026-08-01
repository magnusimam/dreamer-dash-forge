-- ============================================================
-- IDENTITY GATEWAY
-- ------------------------------------------------------------
-- Establishes server-side identity for the whole app.
--
-- Root problem this fixes: the client used to tell the server
-- "I am user X" (p_user_id / p_admin_id / p_telegram_id) and the
-- server trusted it. With the public anon key, anyone could
-- therefore act as anyone (mint DR, drain balances, become admin).
--
-- New model: every privileged action proves identity by passing
-- the SIGNED Telegram `initData` string. The server verifies the
-- HMAC against the bot token, extracts the telegram_id from the
-- *verified* payload, and looks the user up itself. Client-supplied
-- identity is never trusted again.
--
-- SETUP (run ONCE in the Supabase SQL editor after applying):
--   select public.set_app_setting('telegram_bot_token', '<YOUR_BOT_TOKEN>');
-- Optional, DEV/STAGING ONLY (NEVER set this row in production):
--   select public.set_app_setting('dev_user_telegram_id', '0');
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ------------------------------------------------------------
-- app_settings writer (server-side only; not exposed to clients)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_app_setting(p_key TEXT, p_value TEXT)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  INSERT INTO public.app_settings(key, value) VALUES (p_key, p_value)
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
$$;
REVOKE ALL ON FUNCTION public.set_app_setting(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_app_setting(TEXT, TEXT) FROM anon, authenticated;

-- ------------------------------------------------------------
-- url_decode: percent-decode a URL-encoded component (UTF-8 safe).
-- Required because Telegram signs the DECODED field values, but
-- initData arrives URL-encoded.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.url_decode(p_input TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE STRICT
AS $$
DECLARE
  v_bytes BYTEA := '\x';
  v_token TEXT;
BEGIN
  FOR v_token IN
    SELECT (regexp_matches(p_input, '%[0-9A-Fa-f]{2}|.', 'g'))[1]
  LOOP
    IF left(v_token, 1) = '%' AND length(v_token) = 3 THEN
      v_bytes := v_bytes || decode(substr(v_token, 2, 2), 'hex');
    ELSE
      v_bytes := v_bytes || convert_to(v_token, 'UTF8');
    END IF;
  END LOOP;
  RETURN convert_from(v_bytes, 'UTF8');
END;
$$;
REVOKE ALL ON FUNCTION public.url_decode(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.url_decode(TEXT) FROM anon, authenticated;

-- ------------------------------------------------------------
-- verify_init_data: THE gateway. Validates the Telegram initData
-- HMAC and returns the verified `user` object as JSONB.
-- RAISES on any tampering / missing config / expiry.
--
-- Algorithm mirrors supabase/functions/validate-telegram/index.ts:
--   secret_key   = HMAC_SHA256(key="WebAppData", msg=bot_token)
--   data_check   = sorted("key=decoded_value", excluding "hash"), \n-joined
--   computed     = HMAC_SHA256(key=secret_key, msg=data_check) hex
--   valid iff computed == hash AND auth_date within max age
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.verify_init_data(p_init_data TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_bot_token TEXT;
  v_dev_id    TEXT;
  v_window    INTEGER;
  v_pair      TEXT;
  v_key       TEXT;
  v_rawval    TEXT;
  v_val       TEXT;
  v_hash      TEXT;
  v_user_json TEXT;
  v_auth_date BIGINT;
  v_pairs     TEXT[] := ARRAY[]::TEXT[];
  v_dcs       TEXT;
  v_secret    BYTEA;
  v_computed  TEXT;
BEGIN
  -- DEV/STAGING bypass: only active when the setting row exists.
  -- NEVER create 'dev_user_telegram_id' in a production database.
  IF p_init_data IS NULL OR p_init_data = '' THEN
    SELECT value INTO v_dev_id FROM public.app_settings WHERE key = 'dev_user_telegram_id';
    IF v_dev_id IS NOT NULL THEN
      RETURN jsonb_build_object('id', v_dev_id::BIGINT, 'first_name', 'Dreamer', 'username', 'dev');
    END IF;
    RAISE EXCEPTION 'unauthorized: missing initData';
  END IF;

  SELECT value INTO v_bot_token FROM public.app_settings WHERE key = 'telegram_bot_token';
  IF v_bot_token IS NULL THEN
    RAISE EXCEPTION 'server not configured: telegram_bot_token not set';
  END IF;

  -- Parse "key=value" pairs (values stay URL-encoded until decoded).
  FOREACH v_pair IN ARRAY string_to_array(p_init_data, '&') LOOP
    v_key    := split_part(v_pair, '=', 1);
    v_rawval := substr(v_pair, length(v_key) + 2);
    IF v_key = 'hash' THEN
      v_hash := v_rawval;                         -- hex; no decoding needed
    ELSE
      v_val := public.url_decode(v_rawval);
      v_pairs := array_append(v_pairs, v_key || '=' || v_val);
      IF v_key = 'user' THEN v_user_json := v_val; END IF;
      IF v_key = 'auth_date' THEN v_auth_date := v_val::BIGINT; END IF;
    END IF;
  END LOOP;

  IF v_hash IS NULL THEN
    RAISE EXCEPTION 'unauthorized: no hash';
  END IF;

  -- data-check-string: pairs sorted by key (codepoint order), \n-joined.
  SELECT string_agg(p, E'\n' ORDER BY split_part(p, '=', 1) COLLATE "C")
    INTO v_dcs
    FROM unnest(v_pairs) AS p;

  v_secret   := extensions.hmac(convert_to(v_bot_token, 'UTF8'), convert_to('WebAppData', 'UTF8'), 'sha256');
  v_computed := encode(extensions.hmac(convert_to(v_dcs, 'UTF8'), v_secret, 'sha256'), 'hex');

  IF v_computed <> lower(v_hash) THEN
    RAISE EXCEPTION 'unauthorized: bad signature';
  END IF;

  -- Freshness (default 24h; override via app_settings 'init_data_max_age').
  SELECT COALESCE(
    (SELECT value::INTEGER FROM public.app_settings WHERE key = 'init_data_max_age'),
    86400
  ) INTO v_window;

  IF v_auth_date IS NULL OR (EXTRACT(EPOCH FROM now())::BIGINT - v_auth_date) > v_window THEN
    RAISE EXCEPTION 'unauthorized: initData expired';
  END IF;

  IF v_user_json IS NULL THEN
    RAISE EXCEPTION 'unauthorized: no user';
  END IF;

  RETURN v_user_json::JSONB;
END;
$$;
REVOKE ALL ON FUNCTION public.verify_init_data(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.verify_init_data(TEXT) FROM anon, authenticated;

-- ------------------------------------------------------------
-- app_user: resolve the verified caller's full users row.
-- Use this at the top of every privileged RPC instead of
-- trusting a client-supplied id.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.app_user(p_init_data TEXT)
RETURNS public.users
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uj   JSONB;
  v_tid  BIGINT;
  v_user public.users;
BEGIN
  v_uj  := public.verify_init_data(p_init_data);
  v_tid := (v_uj->>'id')::BIGINT;
  SELECT * INTO v_user FROM public.users WHERE telegram_id = v_tid;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unauthorized: user not found';
  END IF;
  RETURN v_user;
END;
$$;
REVOKE ALL ON FUNCTION public.app_user(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_user(TEXT) FROM anon, authenticated;

-- ============================================================
-- CONVERTED RPCs — identity now comes from verified initData.
-- The old client-id signatures are dropped so the insecure
-- versions can no longer be called.
-- ============================================================

-- ------------------------------------------------------------
-- upsert_telegram_user(p_init_data): the linchpin. telegram_id
-- and profile come ONLY from the verified signature, killing
-- account forgery / takeover.
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS public.upsert_telegram_user(BIGINT, TEXT, TEXT, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.upsert_telegram_user(p_init_data TEXT)
RETURNS public.users
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uj   JSONB;
  v_tid  BIGINT;
  v_code TEXT;
  v_user public.users;
BEGIN
  v_uj  := public.verify_init_data(p_init_data);
  v_tid := (v_uj->>'id')::BIGINT;
  v_code := 'DR-' || UPPER(SUBSTRING(MD5(v_tid::TEXT), 1, 8));

  INSERT INTO public.users (telegram_id, first_name, last_name, username, photo_url, language_code, referral_code)
  VALUES (
    v_tid,
    COALESCE(v_uj->>'first_name', 'Dreamer'),
    v_uj->>'last_name',
    v_uj->>'username',
    v_uj->>'photo_url',
    COALESCE(v_uj->>'language_code', 'en'),
    v_code
  )
  ON CONFLICT (telegram_id) DO UPDATE SET
    first_name    = EXCLUDED.first_name,
    last_name     = EXCLUDED.last_name,
    username      = EXCLUDED.username,
    photo_url     = EXCLUDED.photo_url,
    language_code = EXCLUDED.language_code,
    referral_code = COALESCE(public.users.referral_code, v_code),
    updated_at    = NOW()
  RETURNING * INTO v_user;

  RETURN v_user;
END;
$$;

-- ------------------------------------------------------------
-- transfer_dr(p_init_data, ...): sender = verified caller.
-- Also locks the sender row (FOR UPDATE) to stop parallel
-- double-spend.
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS public.transfer_dr(UUID, TEXT, INTEGER, TEXT);

CREATE OR REPLACE FUNCTION public.transfer_dr(
  p_init_data TEXT,
  p_recipient_username TEXT,
  p_amount INTEGER,
  p_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_sender    public.users;
  v_recipient public.users;
BEGIN
  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount must be positive');
  END IF;
  IF p_amount < 10 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Minimum transfer is 10 DR');
  END IF;

  -- Verified identity, then lock the row for the balance check.
  v_sender := public.app_user(p_init_data);
  SELECT * INTO v_sender FROM public.users WHERE id = v_sender.id FOR UPDATE;

  SELECT * INTO v_recipient FROM public.users WHERE LOWER(username) = LOWER(p_recipient_username);
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Recipient not found. Check the username.');
  END IF;

  IF v_sender.id = v_recipient.id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot transfer to yourself');
  END IF;

  IF v_sender.balance < p_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance');
  END IF;

  UPDATE public.users SET balance = balance - p_amount WHERE id = v_sender.id;
  UPDATE public.users SET balance = balance + p_amount WHERE id = v_recipient.id;

  INSERT INTO public.transactions (user_id, type, amount, description)
  VALUES (v_sender.id, 'transfer_out', -p_amount,
          'Transfer to @' || v_recipient.username || COALESCE(': ' || p_note, ''));

  INSERT INTO public.transactions (user_id, type, amount, description)
  VALUES (v_recipient.id, 'transfer_in', p_amount,
          'Transfer from @' || COALESCE(v_sender.username, v_sender.first_name) || COALESCE(': ' || p_note, ''));

  RETURN jsonb_build_object('success', true, 'amount', p_amount,
          'recipient', v_recipient.first_name, 'recipient_username', v_recipient.username);
END;
$$;

-- ------------------------------------------------------------
-- admin_adjust_balance(p_init_data, ...): admin = verified caller,
-- re-checked against is_admin on the SERVER-resolved row.
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS public.admin_adjust_balance(UUID, UUID, INTEGER, TEXT);

CREATE OR REPLACE FUNCTION public.admin_adjust_balance(
  p_init_data TEXT,
  p_user_id UUID,
  p_amount INTEGER,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_admin       public.users;
  v_user        public.users;
  v_today_total INTEGER;
BEGIN
  v_admin := public.app_user(p_init_data);
  IF NOT COALESCE(v_admin.is_admin, FALSE) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;

  IF v_admin.id = p_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot adjust your own balance');
  END IF;

  SELECT COALESCE(SUM(ABS(amount)), 0) INTO v_today_total
  FROM public.admin_audit_log
  WHERE admin_id = v_admin.id AND created_at::date = CURRENT_DATE;

  IF v_today_total + ABS(p_amount) > 5000 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Admin daily adjustment limit reached (5,000 DR/day)');
  END IF;

  SELECT * INTO v_user FROM public.users WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  IF v_user.balance + p_amount < 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Would result in negative balance');
  END IF;

  IF p_amount > 0 AND v_user.balance + p_amount > 50000 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Would exceed wallet cap (50,000 DR)');
  END IF;

  IF p_amount > 0 THEN
    IF NOT public.can_emit(p_amount) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Daily distribution limit reached or treasury empty');
    END IF;
    PERFORM public.record_emission(p_amount);
  ELSE
    PERFORM public.record_recycling(ABS(p_amount));
  END IF;

  UPDATE public.users SET
    balance = balance + p_amount,
    total_earned = CASE WHEN p_amount > 0 THEN total_earned + p_amount ELSE total_earned END
  WHERE id = p_user_id;

  INSERT INTO public.transactions (user_id, type, amount, description)
  VALUES (p_user_id, 'bonus', p_amount, 'Admin adjustment: ' || p_reason);

  INSERT INTO public.admin_audit_log (admin_id, action, target_user_id, amount, reason)
  VALUES (v_admin.id, 'balance_adjustment', p_user_id, p_amount, p_reason);

  RETURN jsonb_build_object('success', true, 'new_balance', v_user.balance + p_amount, 'user', v_user.first_name);
END;
$$;
