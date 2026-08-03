-- Bug: referrals.referrer_id was ON DELETE CASCADE, so deleting a referrer
-- (ban/cleanup/merge) silently deleted the referred user's own referrals row
-- too, even though the referred user is unaffected and still legitimate.
-- Since src/pages/Index.tsx gates app access on having a referrals row, this
-- retroactively locked out real, active users and made them see the
-- mandatory-referral onboarding screen again.
--
-- Fix: referrer_id becomes nullable with ON DELETE SET NULL, so the referred
-- user's row (proof they passed the gate) survives their referrer's deletion.

ALTER TABLE public.referrals
  DROP CONSTRAINT referrals_referrer_id_fkey;

ALTER TABLE public.referrals
  ALTER COLUMN referrer_id DROP NOT NULL;

ALTER TABLE public.referrals
  ADD CONSTRAINT referrals_referrer_id_fkey
  FOREIGN KEY (referrer_id) REFERENCES public.users(id) ON DELETE SET NULL;

-- Backfill the 5 real users already caught by this bug (identified by: no
-- referrals row, not an admin, real account activity, joined within days of
-- the mandatory-referral gate launching 2026-03-21). Their original
-- referrer is unrecoverable since that row was already cascade-deleted, so
-- referrer_id is left NULL here. reward_given is set true since no referral
-- bonus should be (re)paid for a synthetic backfill row.
INSERT INTO public.referrals (referrer_id, referred_id, reward_given, created_at)
VALUES
  (NULL, '51be5505-4124-4fcc-ba67-652ec3a57a67', true, '2026-03-23 11:03:23.339578+00'), -- Joseph / Kink_Jayy7
  (NULL, '314e67f4-6979-41c0-99b9-7f3ca02bb8d0', true, '2026-03-24 20:47:07.498595+00'), -- Divine / Mhiraaaaaaa
  (NULL, '297fcd37-1483-4319-9289-26aa15ee66dc', true, '2026-03-24 21:03:00.547378+00'), -- Samuel / basemuel (chikasamuel2a)
  (NULL, '0f11f0ce-b4c2-41bd-a107-983ab3effcff', true, '2026-03-24 21:06:45.124129+00'), -- Ruth
  (NULL, 'f1c22135-b857-4748-a211-c807ef196ec6', true, '2026-03-24 21:19:53.884401+00')  -- Grace / Gracie_16_001
ON CONFLICT (referred_id) DO NOTHING;
