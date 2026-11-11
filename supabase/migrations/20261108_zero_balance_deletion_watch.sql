-- ============================================================
-- ZERO-BALANCE DELETION WATCH + SERVER-SIDE DAILY PENALTIES
-- ------------------------------------------------------------
-- Requires 20261107_inactivity_reward_all_active.sql (weighted split to
-- all active members) — this file re-declares that function with the
-- additions below, so apply 20261107 first, then this.
--
-- 1. Penalties now run daily on the server (cron -> inactivity-cron edge
--    function -> cron_inactivity_tick()), not only when the inactive
--    member happens to open the app. The app-open path still works; the
--    last_penalty_date guard keeps it to one penalty per user per day.
--
-- 2. When an inactivity penalty leaves a non-admin member at 0 DR, they go
--    on a 5-day deletion watch. The edge function broadcasts this to the
--    whole community. Anyone can send them DR (rescue_transfer, which works
--    by watch id so members with no @username can still be saved).
--
-- 3. At the deadline: balance > 0 (from rescue gifts OR the member coming
--    back and checking in) -> SAVED. Balance 0 -> account DELETED. Both
--    outcomes are broadcast.
--
-- 4. While on watch, and for 30 days after being saved, the member is
--    exempt from inactivity penalties — otherwise the next day's penalty
--    would take the rescue DR straight back off them.
--
-- account_deletion_watch keeps a snapshot (name, username, telegram_id)
-- and survives the user's deletion (user_id -> SET NULL), so it doubles as
-- the audit trail for automatic deletions.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.account_deletion_watch (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid REFERENCES public.users(id) ON DELETE SET NULL,
  deleted_user_id       uuid,                 -- original id, kept after deletion
  first_name            text,
  username              text,
  telegram_id           bigint,
  state_id              uuid,
  days_inactive         integer,
  flagged_at            timestamptz NOT NULL DEFAULT now(),
  delete_after          timestamptz NOT NULL DEFAULT now() + interval '5 days',
  status                text NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'saved', 'deleted', 'delete_failed')),
  resolved_at           timestamptz,
  final_balance         integer,
  rescued_dr            integer NOT NULL DEFAULT 0,
  error                 text,
  announced_at          timestamptz,          -- "will be deleted in 5 days" broadcast sent
  outcome_announced_at  timestamptz           -- "saved" / "deleted" broadcast sent
);

CREATE UNIQUE INDEX IF NOT EXISTS account_deletion_watch_one_pending
  ON public.account_deletion_watch (user_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS account_deletion_watch_status_idx
  ON public.account_deletion_watch (status, delete_after);

ALTER TABLE public.account_deletion_watch ENABLE ROW LEVEL SECURITY;
-- No policies: clients read it only through get_accounts_at_risk(); the
-- edge function uses the service role.
REVOKE ALL ON public.account_deletion_watch FROM anon, authenticated;


-- ------------------------------------------------------------
-- Penalty (weighted split to all active members) + watch flagging
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._apply_inactivity_penalty(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_user RECORD;
  v_days_inactive INTEGER;
  v_penalty INTEGER := 0;
  v_warning TEXT := NULL;
  v_recipients INTEGER := 0;
  v_flagged BOOLEAN := FALSE;
BEGIN
  SELECT * INTO v_user FROM public.users WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('penalty', 0);
  END IF;

  IF v_user.last_check_in IS NULL THEN
    v_days_inactive := CURRENT_DATE - v_user.created_at::DATE;
  ELSE
    v_days_inactive := CURRENT_DATE - v_user.last_check_in;
  END IF;

  IF v_days_inactive < 7 THEN
    RETURN jsonb_build_object('penalty', 0);
  END IF;

  IF v_user.last_penalty_date IS NOT NULL AND v_user.last_penalty_date = CURRENT_DATE THEN
    RETURN jsonb_build_object('penalty', 0);
  END IF;

  -- Exempt while on deletion watch, and for 30 days after being saved.
  IF EXISTS (
    SELECT 1 FROM public.account_deletion_watch w
     WHERE w.user_id = p_user_id
       AND (w.status = 'pending'
            OR (w.status = 'saved' AND w.resolved_at > now() - interval '30 days'))
  ) THEN
    RETURN jsonb_build_object('penalty', 0, 'days_inactive', v_days_inactive, 'protected', true);
  END IF;

  IF v_days_inactive >= 30 THEN
    v_penalty := v_user.balance;
    v_warning := '30_day_warning';
  ELSIF v_days_inactive >= 14 THEN
    v_penalty := LEAST(v_user.balance, 500);
  ELSE
    v_penalty := LEAST(v_user.balance, 100);
  END IF;
  v_penalty := GREATEST(v_penalty, 0);

  UPDATE public.users
     SET balance = balance - v_penalty, last_penalty_date = CURRENT_DATE
   WHERE id = p_user_id;

  -- Hit 0 DR through inactivity -> 5-day deletion watch (never admins).
  IF v_user.balance - v_penalty <= 0 AND NOT COALESCE(v_user.is_admin, FALSE) THEN
    INSERT INTO public.account_deletion_watch
      (user_id, deleted_user_id, first_name, username, telegram_id, state_id, days_inactive)
    VALUES
      (p_user_id, p_user_id, v_user.first_name, v_user.username, v_user.telegram_id,
       v_user.state_id, v_days_inactive)
    ON CONFLICT DO NOTHING;
    v_flagged := FOUND;
  END IF;

  IF v_penalty = 0 THEN
    RETURN jsonb_build_object('penalty', 0, 'days_inactive', v_days_inactive,
                              'deletion_watch', v_flagged);
  END IF;

  INSERT INTO public.transactions (user_id, type, amount, description)
  VALUES (p_user_id, 'bonus', -v_penalty,
          'Inactivity penalty (' || v_days_inactive || ' days without check-in)');

  -- Weighted split to every member of the state active in the last 7 days
  IF v_user.state_id IS NOT NULL THEN
    CREATE TEMP TABLE IF NOT EXISTS _inact_split (user_id uuid, amount integer) ON COMMIT DROP;
    TRUNCATE _inact_split;

    INSERT INTO _inact_split (user_id, amount)
    WITH active AS (
      SELECT u.id,
             LEAST(7, (SELECT COUNT(*) FROM public.daily_checkins c
                        WHERE c.user_id = u.id AND c.check_in_date >= CURRENT_DATE - 7))
           + LEAST(7, (SELECT COUNT(*) FROM public.activity_logs a
                        WHERE a.user_id = u.id AND a.logged_at >= CURRENT_DATE - 7))
           + 2 * (SELECT COUNT(*) FROM public.mission_completions m
                   WHERE m.user_id = u.id AND m.status = 'approved'
                     AND m.completed_at >= CURRENT_DATE - 7) AS raw_score
        FROM public.users u
       WHERE u.state_id = v_user.state_id
         AND u.id <> p_user_id
         AND u.last_check_in IS NOT NULL
         AND u.last_check_in >= CURRENT_DATE - 7
    ),
    scored AS (
      SELECT id, GREATEST(raw_score, 1)::numeric AS score FROM active
    ),
    base AS (
      SELECT id, score,
             floor(v_penalty * score / SUM(score) OVER ())::integer AS base_amt,
             (v_penalty * score / SUM(score) OVER ())
               - floor(v_penalty * score / SUM(score) OVER ()) AS frac
        FROM scored
    ),
    ranked AS (
      SELECT id, base_amt,
             ROW_NUMBER() OVER (ORDER BY frac DESC, score DESC, id) AS rn,
             v_penalty - SUM(base_amt) OVER () AS leftover
        FROM base
    )
    SELECT id, base_amt + CASE WHEN rn <= leftover THEN 1 ELSE 0 END
      FROM ranked;

    SELECT COUNT(*) INTO v_recipients FROM _inact_split;

    IF v_recipients > 0 THEN
      UPDATE public.users u
         SET balance = u.balance + s.amount
        FROM _inact_split s
       WHERE u.id = s.user_id AND s.amount > 0;

      INSERT INTO public.transactions (user_id, type, amount, description)
      SELECT user_id, 'bonus', amount, 'Inactivity reward from inactive member'
        FROM _inact_split WHERE amount > 0;

      RETURN jsonb_build_object('penalty', v_penalty, 'days_inactive', v_days_inactive,
                                'warning', v_warning, 'deletion_watch', v_flagged,
                                'distributed_to', (SELECT COUNT(*) FROM _inact_split WHERE amount > 0));
    END IF;
  END IF;

  PERFORM public.record_recycling(v_penalty);
  RETURN jsonb_build_object('penalty', v_penalty, 'days_inactive', v_days_inactive,
                            'warning', v_warning, 'deletion_watch', v_flagged,
                            'distributed_to', 0);
END;
$function$;

REVOKE ALL ON FUNCTION public._apply_inactivity_penalty(uuid) FROM PUBLIC, anon, authenticated;


-- ------------------------------------------------------------
-- Automatic deletion (mirrors _admin_delete_user, minus the admin check)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._auto_delete_inactive_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_user public.users%ROWTYPE;
BEGIN
  SELECT * INTO v_user FROM public.users WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  IF COALESCE(v_user.is_admin, FALSE) THEN
    RAISE EXCEPTION 'Refusing to auto-delete an admin account';
  END IF;

  IF v_user.balance > 0 THEN
    PERFORM public.record_recycling(v_user.balance);
  END IF;

  UPDATE public.users SET state_id = NULL WHERE id = p_user_id;
  UPDATE public.activities SET created_by = NULL WHERE created_by = p_user_id;
  UPDATE public.hackathons SET created_by = NULL WHERE created_by = p_user_id;
  UPDATE public.redemption_requests SET processed_by = NULL WHERE processed_by = p_user_id;
  UPDATE public.admin_audit_log SET target_user_id = NULL WHERE target_user_id = p_user_id;

  DELETE FROM public.users WHERE id = p_user_id;
END;
$function$;

REVOKE ALL ON FUNCTION public._auto_delete_inactive_user(uuid) FROM PUBLIC, anon, authenticated;


-- ------------------------------------------------------------
-- Hourly tick: run today's penalties, then resolve expired watches.
-- Called only by the inactivity-cron edge function (service role).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cron_inactivity_tick()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  r RECORD;
  v_res jsonb;
  v_penalized INTEGER := 0;
  v_flagged INTEGER := 0;
  v_saved INTEGER := 0;
  v_deleted INTEGER := 0;
  v_failed INTEGER := 0;
  v_balance INTEGER;
BEGIN
  -- 1. Daily penalties for everyone 7+ days inactive not yet hit today.
  FOR r IN
    SELECT id FROM public.users
     WHERE COALESCE(last_check_in, created_at::date) <= CURRENT_DATE - 7
       AND (last_penalty_date IS NULL OR last_penalty_date < CURRENT_DATE)
  LOOP
    v_res := public._apply_inactivity_penalty(r.id);
    IF COALESCE((v_res->>'penalty')::int, 0) > 0 THEN v_penalized := v_penalized + 1; END IF;
    IF COALESCE((v_res->>'deletion_watch')::boolean, false) THEN v_flagged := v_flagged + 1; END IF;
  END LOOP;

  -- 2. Resolve watches whose 5 days are up.
  FOR r IN
    SELECT * FROM public.account_deletion_watch
     WHERE status = 'pending' AND delete_after <= now()
     FOR UPDATE SKIP LOCKED
  LOOP
    SELECT balance INTO v_balance FROM public.users WHERE id = r.user_id;

    IF NOT FOUND THEN
      -- Already gone (e.g. an admin deleted them manually).
      UPDATE public.account_deletion_watch
         SET status = 'deleted', resolved_at = now(), final_balance = 0,
             outcome_announced_at = now()          -- nothing to announce
       WHERE id = r.id;
    ELSIF v_balance > 0 THEN
      UPDATE public.account_deletion_watch
         SET status = 'saved', resolved_at = now(), final_balance = v_balance
       WHERE id = r.id;
      v_saved := v_saved + 1;
    ELSE
      BEGIN
        PERFORM public._auto_delete_inactive_user(r.user_id);
        UPDATE public.account_deletion_watch
           SET status = 'deleted', resolved_at = now(), final_balance = 0
         WHERE id = r.id;
        v_deleted := v_deleted + 1;
      EXCEPTION WHEN OTHERS THEN
        UPDATE public.account_deletion_watch
           SET status = 'delete_failed', resolved_at = now(), error = SQLERRM,
               outcome_announced_at = now()        -- don't announce a deletion that didn't happen
         WHERE id = r.id;
        v_failed := v_failed + 1;
      END;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('penalized', v_penalized, 'flagged', v_flagged,
                            'saved', v_saved, 'deleted', v_deleted, 'delete_failed', v_failed);
END;
$function$;

REVOKE ALL ON FUNCTION public.cron_inactivity_tick() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cron_inactivity_tick() TO service_role;


-- ------------------------------------------------------------
-- Client RPCs
-- ------------------------------------------------------------

-- Accounts currently on the 5-day watch (for the in-app rescue banner).
CREATE OR REPLACE FUNCTION public.get_accounts_at_risk(p_init_data text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_me public.users;
BEGIN
  v_me := public.app_user(p_init_data);
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
             'watch_id',     w.id,
             'first_name',   u.first_name,
             'last_name',    u.last_name,
             'username',     u.username,
             'photo_url',    u.photo_url,
             'state',        s.name,
             'balance',      u.balance,
             'rescued_dr',   w.rescued_dr,
             'delete_after', w.delete_after,
             'is_me',        u.id = v_me.id
           ) ORDER BY w.delete_after)
      FROM public.account_deletion_watch w
      JOIN public.users u ON u.id = w.user_id
      LEFT JOIN public.states s ON s.id = u.state_id
     WHERE w.status = 'pending'
  ), '[]'::jsonb);
END;
$function$;

REVOKE ALL ON FUNCTION public.get_accounts_at_risk(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_accounts_at_risk(text) TO anon, authenticated;

-- Send DR to a member on the watch. Works by watch id, so members with no
-- @username can be saved too. Same rules as transfer_dr (min 10 DR).
CREATE OR REPLACE FUNCTION public.rescue_transfer(p_init_data text, p_watch_id uuid, p_amount integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_sender    public.users;
  v_recipient public.users;
  v_watch     public.account_deletion_watch;
BEGIN
  IF p_amount IS NULL OR p_amount < 10 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Minimum is 10 DR');
  END IF;

  v_sender := public.app_user(p_init_data);
  SELECT * INTO v_sender FROM public.users WHERE id = v_sender.id FOR UPDATE;

  SELECT * INTO v_watch FROM public.account_deletion_watch
   WHERE id = p_watch_id AND status = 'pending' FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'This account is no longer at risk');
  END IF;

  SELECT * INTO v_recipient FROM public.users WHERE id = v_watch.user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Account not found');
  END IF;

  IF v_sender.id = v_recipient.id THEN
    RETURN jsonb_build_object('success', false, 'error', 'You can''t rescue yourself — check in to earn DR!');
  END IF;

  IF v_sender.balance < p_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance');
  END IF;

  UPDATE public.users SET balance = balance - p_amount WHERE id = v_sender.id;
  UPDATE public.users SET balance = balance + p_amount WHERE id = v_recipient.id;
  UPDATE public.account_deletion_watch SET rescued_dr = rescued_dr + p_amount WHERE id = v_watch.id;

  INSERT INTO public.transactions (user_id, type, amount, description)
  VALUES (v_sender.id, 'transfer_out', -p_amount,
          'Rescue gift to ' || COALESCE('@' || v_recipient.username, v_recipient.first_name));

  INSERT INTO public.transactions (user_id, type, amount, description)
  VALUES (v_recipient.id, 'transfer_in', p_amount,
          'Rescue gift from ' || COALESCE('@' || v_sender.username, v_sender.first_name));

  RETURN jsonb_build_object('success', true, 'amount', p_amount,
                            'recipient', v_recipient.first_name,
                            'recipient_telegram_id', v_recipient.telegram_id);
END;
$function$;

REVOKE ALL ON FUNCTION public.rescue_transfer(text, uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rescue_transfer(text, uuid, integer) TO anon, authenticated;


-- ------------------------------------------------------------
-- Hourly cron -> inactivity-cron edge function (same secret pattern as
-- checkin-reminder: bearer + X-Cron-Secret read from app_settings).
-- ------------------------------------------------------------
DO $$ BEGIN PERFORM cron.unschedule('inactivity-tick'); EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'inactivity-tick',
  '5 * * * *',
  $cron$
  select net.http_post(
    url     := 'https://stmgzykdildmlbvubtvs.supabase.co/functions/v1/inactivity-cron',
    body    := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || (select value from public.app_settings where key = 'edge_bearer'),
      'X-Cron-Secret', (select value from public.app_settings where key = 'cron_secret')
    ),
    timeout_milliseconds := 120000
  );
  $cron$
);
