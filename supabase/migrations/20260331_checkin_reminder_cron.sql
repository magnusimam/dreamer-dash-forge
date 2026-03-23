-- ============================================================
-- Scheduled daily check-in reminders via pg_cron + pg_net
-- Sends Telegram reminders to users who haven't checked in yet.
--
-- WAT (West Africa Time) = UTC+1
-- Evening reminder:  6:00 PM WAT = 17:00 UTC
-- Urgent reminder:  10:00 PM WAT = 21:00 UTC
--
-- IMPORTANT: After deploying, you must set these Supabase vault
-- secrets (or use the SQL editor) so the cron jobs can call your
-- edge function:
--
--   SUPABASE_URL       — your project URL (e.g. https://xyz.supabase.co)
--   SUPABASE_SERVICE_ROLE_KEY — your service role key
--
-- These are already available as env vars inside edge functions,
-- but pg_cron needs them stored in the database to make HTTP calls.
--
-- To set them via SQL editor:
--   ALTER DATABASE postgres SET app.supabase_url = 'https://xyz.supabase.co';
--   ALTER DATABASE postgres SET app.service_role_key = 'your-key-here';
-- ============================================================

-- Enable required extensions (already enabled on most Supabase projects)
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- Evening reminder (6 PM WAT / 5 PM UTC) — friendly nudge
select cron.schedule(
  'checkin-reminder-evening',
  '0 17 * * *',
  $$
  select net.http_post(
    url   := current_setting('app.supabase_url') || '/functions/v1/checkin-reminder',
    body  := '{"type":"evening"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    )
  );
  $$
);

-- Urgent reminder (10 PM WAT / 9 PM UTC) — last chance
select cron.schedule(
  'checkin-reminder-urgent',
  '0 21 * * *',
  $$
  select net.http_post(
    url   := current_setting('app.supabase_url') || '/functions/v1/checkin-reminder',
    body  := '{"type":"urgent"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    )
  );
  $$
);
