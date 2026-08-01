# Pre/post-deploy checks

Run both after applying any migration and before/after deploying the frontend.
Both were added 2026-08-01 after a night of outages caused by the frontend and
the live database disagreeing about an RPC's signature.

## 1. Smoke test — does the identity gateway + core RPCs actually work?

```
curl -X POST "https://stmgzykdildmlbvubtvs.supabase.co/functions/v1/smoke-test" \
  -H "Authorization: Bearer <anon/publishable key>" \
  -H "X-Smoke-Test-Secret: <the SMOKE_TEST_SECRET edge secret>"
```

Builds a genuinely-signed Telegram `initData` for a dedicated test account
(`telegram_id 999999999` — never a real user) and calls `upsert_telegram_user`,
`get_me`, `transfer_dr`, `submit_contribution`, `open_magic_box`, and
`request_pair_extension` against whatever is actually live right now.

Expect `"ok": true`. Any RPC-not-found / signature / permission error shows up
as a non-200 in `checks[].http_status` — that's exactly the class of bug that
caused tonight's "infinite loading" outages, caught automatically instead of
by a user reporting it.

`SMOKE_TEST_SECRET` lives only as an edge function secret (`supabase secrets
list` shows it hashed) — ask whoever has dashboard access if you need to
rotate it, or generate + `supabase secrets set` a new one.

## 2. Write-grant audit — did a new table forget its RLS/grants?

```
supabase db query --linked -f scripts/audit-write-grants.sql
```

Expect **zero rows**. Any row means anon/authenticated can write to that
table directly, bypassing every RPC's validation and the identity gateway
entirely. Run this after any migration that creates a table — a new table
defaults to open grants and needs an explicit `REVOKE ... FROM anon,
authenticated` (see any `phase2*` migration for the pattern), same as it
needs RLS enabled if it's ever exposed to `select`.
