# Security Remediation — Identity Gateway (Phase 1)

This is the foundational fix from the security audit: **the server now establishes
identity itself** from the signed Telegram `initData`, instead of trusting whatever
user/admin id the client sends. With the public anon key, the old model let anyone act
as anyone (mint DR, drain balances, self-promote to admin).

## What changed in this phase

**New SQL gateway** (`supabase/migrations/20260615_identity_gateway.sql`)
- `verify_init_data(initData)` — validates the Telegram HMAC against the bot token and
  returns the **verified** user. Raises on any tampering/expiry. (Fixes the URL-decode bug
  in the old, never-used `validate_telegram_init_data`.)
- `app_user(initData)` — resolves the verified caller's `users` row. Use at the top of
  every privileged RPC.
- `set_app_setting(key, value)` — server-only writer for config (bot token etc.); revoked
  from `anon`/`authenticated`.

**Converted RPCs** (identity now derived from the signature, old insecure signatures dropped):
- `upsert_telegram_user(p_init_data)` — telegram_id + profile come only from the verified
  payload → kills account forgery/takeover.
- `transfer_dr(p_init_data, …)` — sender = verified caller; row-locked to stop double-spend.
- `admin_adjust_balance(p_init_data, …)` — admin re-checked against the server-resolved row.

**Frontend** — `UserContext` and the transfer/adjust hooks now pass `initData`; the
fail-open client-side `validate-telegram` call was removed.

## How to apply (in order)

1. **Apply the migration** to the database (Supabase SQL editor → paste the file, or
   `supabase db push` once the CLI is set up).
2. **Set the bot token** (one time), in the SQL editor:
   ```sql
   select public.set_app_setting('telegram_bot_token', '<YOUR_TELEGRAM_BOT_TOKEN>');
   ```
   This is the same token already in the `validate-telegram` edge function env
   (`TELEGRAM_BOT_TOKEN`). It is stored in `app_settings`, which has no client read access.
3. **Deploy the frontend** (the updated `UserContext` + hooks).
4. **Smoke-test in Telegram**: open the Mini App → you should load normally, do a check-in,
   and a transfer. If login fails, the token in step 2 is wrong/missing.

### Self-test the gateway (SQL editor)
```sql
-- Should return the user JSON for a REAL initData string copied from a Telegram session:
select public.verify_init_data('<paste a real initData string>');
-- Tamper one character → should RAISE 'unauthorized: bad signature'.
```

### Local/browser dev (no Telegram, initData is empty)
The gateway refuses empty initData **unless** a dev row exists. For a dev/staging DB only:
```sql
select public.set_app_setting('dev_user_telegram_id', '0');   -- maps the browser DEV_USER
```
**Never create `dev_user_telegram_id` in production** — it would let an unsigned client log in.

## Rollback
Re-applying the pre-existing migrations recreates the old function signatures. Because the
frontend now sends `p_init_data`, roll back frontend and DB together if needed.

---

## Phase 2A — RPC auth conversion (DONE)

`supabase/migrations/20260616_phase2_rpc_auth.sql` converted all 28 remaining privileged
RPCs to the gateway. Each original function was renamed to `_<name>` (logic untouched),
revoked from anon, and fronted by a secure wrapper `<name>(p_init_data, …)` that resolves
identity via `app_user()` (and re-checks `is_admin` for the 7 admin functions +
`auto_pair_dreamers`, which was previously unauthenticated). All frontend call sites in
`useSupabase.ts`, `Admin.tsx`, and `Index.tsx` now pass `getInitData()` instead of a
client id. Apply this migration AFTER the bot token is set (Phase 1 step 2), or every RPC
returns "unauthorized". Untested against the live DB — apply inside a transaction (the file
wraps itself in BEGIN/COMMIT) and smoke-test check-in / mission / redemption / an admin
action.

## Phase 2B — direct writes → RPCs (DONE)

`supabase/migrations/20260617_phase2_write_rpcs.sql` adds RPCs for every former direct
table write: self-service (`set_my_birthday`, `save_my_bank_details`, `touch_last_active` —
caller's own row only) and admin content CRUD (promo codes, redemption categories, missions,
mentors, activities, hackathons, raffles, states, featured/MVP spotlight) gated on the
verified caller's `is_admin` via the new `app_admin()` helper. All 25 frontend hooks (in
`useSupabase.ts` + the MVP write in `Index.tsx`) now call these RPCs; verified by grep that
zero `.from().insert/update/delete` remain in `src/`.

## Phase 2C — write lockdown (DONE — APPLY LAST)

`supabase/migrations/20260618_phase2_rls_write_lockdown.sql` revokes
`INSERT/UPDATE/DELETE` from `anon`/`authenticated` on every sensitive table (privilege-level,
so it holds regardless of leftover `USING(true)` policies; `SECURITY DEFINER` RPCs and
`service_role` are unaffected). Uses a DO-block that skips any non-existent table. **Apply
only AFTER 2A+2B are applied and the updated frontend is deployed**, or direct-write features
break before the RPC paths are live.

## Phase 2D — bank-PII read hardening (DONE)

`supabase/migrations/20260619_phase2_bank_pii.sql` revokes column SELECT on
`bank_name/account_number/account_name` from `anon`/`authenticated` and adds `get_me(initData)`
(SECURITY DEFINER) so the owner still loads their own full row. Frontend: `refreshUser` now
calls `get_me`; the cross-user leak in `useUserProfile`/`UserProfileModal` (which showed ANY
user's bank details) is removed; `useAllUsers` and the user-count query no longer `select('*')`.
Verified by grep: no `select('*')` on `users` and no client read of bank columns remain.

Residual (lower severity): `telegram_id` and `birthday` are still client-readable — used by
notifications and birthday features. Lock down later if desired (telegram_id enables bot
spam, partly mitigated by the pending send-notification hardening).

## Phase 2 — remaining work

**Row-lock hardening (partially done).** `transfer_dr` and `admin_adjust_balance` now lock
the user row (`FOR UPDATE`). The remaining balance/supply mutations (`enter_raffle`,
`submit_redemption`, `claim_promo_code`, `buy_streak_insurance`, the emission helpers) still
have TOCTOU windows — add `SELECT … FOR UPDATE` on the user / `token_supply` / `promo_codes`
rows inside each.

## Phase 2E — edge functions / config hardening (DONE)

- **`send-notification`** now verifies signed `initData` (HMAC) → only authenticated app
  users can trigger bot messages; the frontend (`notifications.ts`, the inactivity warning)
  passes `getInitData()`. *Residual:* a logged-in user can still message other users —
  fully eliminating that requires moving sends server-side (into the RPCs via pg_net).
- **`telegram-webhook`** verifies `X-Telegram-Bot-Api-Secret-Token` (enforced when
  `TELEGRAM_WEBHOOK_SECRET` is set).
- **`checkin-reminder`** requires `X-Cron-Secret` (enforced when `CRON_SECRET` is set);
  `20260620_checkin_reminder_secret.sql` reschedules the cron to send that header, reading
  the secret + edge bearer from `app_settings` (no secret committed; replaces the old cron
  that hard-coded the anon JWT).
- **`vercel.json`** — replaced the invalid `X-Frame-Options: ALLOWALL` with
  `Content-Security-Policy: frame-ancestors` allowing only Telegram to embed (anti-clickjack).
- **`.gitignore`** — now ignores `.env` / `.env.*`.

### Required setup (operational — do once)
| Where | Action |
|---|---|
| SQL editor | `select set_app_setting('telegram_bot_token','<token>')` (Phase 1) |
| SQL editor | `select set_app_setting('edge_bearer','<anon key>')` and `set_app_setting('cron_secret','<random>')` |
| Edge env: `send-notification`, `telegram-webhook`, `checkin-reminder` | ensure `TELEGRAM_BOT_TOKEN`; set `TELEGRAM_WEBHOOK_SECRET` and `CRON_SECRET` (CRON_SECRET == the `cron_secret` app_setting) |
| Telegram | `setWebhook` with `secret_token = TELEGRAM_WEBHOOK_SECRET` |
| Edge env: `cloudinary-sign` | set `CLOUDINARY_API_KEY` + `CLOUDINARY_API_SECRET`; `TELEGRAM_BOT_TOKEN` |
| Cloudinary console | set the `dreamer_dash` upload preset to **Signed** (or delete it) so the old unsigned path closes |
| Vercel/Supabase | **rotate the anon key** (it was committed) and `git rm --cached .env` |

## Phase 2F — row-lock & Cloudinary hardening (DONE)

- **Row locks** (`20260621_row_locks.sql`): the balance-debit wrappers (`enter_raffle`,
  `submit_redemption`, `buy_streak_insurance`, `register_hackathon`, `unlock_mission`) now
  `SELECT … FOR UPDATE` the caller's row before calling the internal — the lock is held for
  the whole transaction, so concurrent debits serialize (no more double-spend). `claim_promo_code`
  locks the promo row (no double-claim). `can_emit` now locks the `token_supply` row, making the
  cap-check + `record_emission` atomic (21M / daily cap can't be raced). Logic internals
  untouched — only the wrappers/`can_emit` read were changed.
- **Cloudinary signed uploads**: new `cloudinary-sign` edge function verifies `initData`,
  enforces a folder allowlist, and signs server-side with the Cloudinary API secret;
  `src/lib/storage.ts` now does a signed upload (call sites unchanged). Requires edge env
  `CLOUDINARY_API_KEY` + `CLOUDINARY_API_SECRET`, **and** setting the `dreamer_dash` preset to
  *Signed* (or deleting it) in the Cloudinary console — otherwise the old unsigned path stays open.

## Phase 2 — remaining work

**Residual reads** — `telegram_id` / `birthday` are still client-readable (used by
notifications and birthday features). Lock down later if desired.

That is the full audit remediation. See the audit for severities and concrete exploits.
