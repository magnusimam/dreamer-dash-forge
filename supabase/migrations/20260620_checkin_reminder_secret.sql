-- ============================================================
-- PHASE 2E — SECURE THE CHECK-IN REMINDER CRON
-- ------------------------------------------------------------
-- The old cron (20260331) hard-coded the anon JWT and invoked
-- checkin-reminder with no shared secret, so anyone who found the
-- function URL could trigger a fan-out to every user (bot spam / ban).
--
-- This reschedules both jobs to send an `X-Cron-Secret` header, with
-- BOTH the edge bearer and the secret read from app_settings at fire
-- time — so no secret is committed to the repo.
--
-- SETUP (run once in the SQL editor, then redeploy the function):
--   select public.set_app_setting('edge_bearer', '<your Supabase anon key>');
--   select public.set_app_setting('cron_secret', '<a long random string>');
-- Then set the SAME value as CRON_SECRET in the checkin-reminder edge
-- function's environment. (cron runs as postgres, which bypasses the
-- app_settings RLS, so the SELECTs below resolve at fire time.)
-- ============================================================

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

do $$ begin perform cron.unschedule('checkin-reminder-evening'); exception when others then null; end $$;
do $$ begin perform cron.unschedule('checkin-reminder-urgent');  exception when others then null; end $$;

-- Evening reminder (6 PM WAT / 5 PM UTC)
select cron.schedule(
  'checkin-reminder-evening',
  '0 17 * * *',
  $cron$
  select net.http_post(
    url     := 'https://stmgzykdildmlbvubtvs.supabase.co/functions/v1/checkin-reminder',
    body    := '{"type":"evening"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || (select value from public.app_settings where key = 'edge_bearer'),
      'X-Cron-Secret', (select value from public.app_settings where key = 'cron_secret')
    )
  );
  $cron$
);

-- Urgent reminder (10 PM WAT / 9 PM UTC)
select cron.schedule(
  'checkin-reminder-urgent',
  '0 21 * * *',
  $cron$
  select net.http_post(
    url     := 'https://stmgzykdildmlbvubtvs.supabase.co/functions/v1/checkin-reminder',
    body    := '{"type":"urgent"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || (select value from public.app_settings where key = 'edge_bearer'),
      'X-Cron-Secret', (select value from public.app_settings where key = 'cron_secret')
    )
  );
  $cron$
);
