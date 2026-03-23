-- ============================================================
-- Scheduled daily check-in reminders via pg_cron + pg_net
-- Sends Telegram reminders to users who haven't checked in yet.
--
-- WAT (West Africa Time) = UTC+1
-- Evening reminder:  6:00 PM WAT = 17:00 UTC
-- Urgent reminder:  10:00 PM WAT = 21:00 UTC
-- ============================================================

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- Evening reminder (6 PM WAT / 5 PM UTC) — friendly nudge
select cron.schedule(
  'checkin-reminder-evening',
  '0 17 * * *',
  $$
  select net.http_post(
    url   := 'https://stmgzykdildmlbvubtvs.supabase.co/functions/v1/checkin-reminder',
    body  := '{"type":"evening"}'::jsonb,
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0bWd6eWtkaWxkbWxidnVidHZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwNDcxNzEsImV4cCI6MjA4OTYyMzE3MX0.e6pOI5lHZNsfbY211B-hWI9QBj-mXClbZVnEPSN0Wxo"}'::jsonb
  );
  $$
);

-- Urgent reminder (10 PM WAT / 9 PM UTC) — last chance
select cron.schedule(
  'checkin-reminder-urgent',
  '0 21 * * *',
  $$
  select net.http_post(
    url   := 'https://stmgzykdildmlbvubtvs.supabase.co/functions/v1/checkin-reminder',
    body  := '{"type":"urgent"}'::jsonb,
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0bWd6eWtkaWxkbWxidnVidHZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwNDcxNzEsImV4cCI6MjA4OTYyMzE3MX0.e6pOI5lHZNsfbY211B-hWI9QBj-mXClbZVnEPSN0Wxo"}'::jsonb
  );
  $$
);
