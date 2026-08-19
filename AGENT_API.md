# Agent API

A read-only HTTP API for external tooling (e.g. a personal AI assistant) to query
the platform — separate from, and unrelated to, the Telegram Mini App's identity
gateway (`SECURITY_REMEDIATION.md`). The Mini App proves "which Telegram user is
this"; this API instead trusts one static bearer key, because the caller isn't a
Telegram session at all.

Implementation: `supabase/functions/agent-api/index.ts`. Backing migration:
`supabase/migrations/20260814_agent_api_and_error_logging.sql` (also adds the
`app_errors` table + `log_client_error` RPC the frontend now reports into).

## Setup (one time)

```sh
supabase secrets set AGENT_API_KEY=$(openssl rand -hex 32)
supabase functions deploy agent-api
```

Keep the generated key private — it grants read access to the whole allow-listed
schema below (bank details excluded). Store it only in your AI's tool/action config.

## Calling it

Every request needs the header `X-Agent-Api-Key: <key>`. GET only — the API has no
write endpoints at all.

```
https://<project-ref>.supabase.co/functions/v1/agent-api/<route>
```

### `GET /tables`

Self-describing schema listing — every allow-listed table and which columns (if
any) are always stripped from responses. Call this first if you don't already know
what's queryable.

### `GET /table/:name`

Generic filtered read of any allow-listed table.

| Query param | Meaning |
|---|---|
| `column=value` | equality filter on that column |
| `select` | comma-separated column list (default `*`) |
| `order` | `column.asc` or `column.desc` |
| `limit` | default 100, capped at 500 |
| `offset` | pagination offset |

```sh
curl -H "X-Agent-Api-Key: $KEY" \
  "https://<ref>.supabase.co/functions/v1/agent-api/table/daily_checkins?limit=20&order=check_in_date.desc"

curl -H "X-Agent-Api-Key: $KEY" \
  "https://<ref>.supabase.co/functions/v1/agent-api/table/users?telegram_id=123456789"

curl -H "X-Agent-Api-Key: $KEY" \
  "https://<ref>.supabase.co/functions/v1/agent-api/table/app_errors?limit=20&order=occurred_at.desc"
```

`users` always has `bank_name`, `account_number`, `account_name` stripped from the
response, regardless of what `select` asks for.

### `GET /rpc/:name`

Proxies existing report-style database functions directly (no reimplementation):

| Route | Underlying function | Params |
|---|---|---|
| `/rpc/leaderboard` | `get_leaderboard` | `limit` (default 50, max 500) |
| `/rpc/state-rankings` | `get_state_rankings` | — |
| `/rpc/community-stats` | `get_community_stats` | — |
| `/rpc/redemptions` | `get_user_redemptions` | `user_id` (required) |

```sh
curl -H "X-Agent-Api-Key: $KEY" \
  "https://<ref>.supabase.co/functions/v1/agent-api/rpc/leaderboard?limit=10"
```

## Allow-listed tables

`users`, `activities`, `activity_logs`, `daily_checkins`, `hackathons`,
`hackathon_registrations`, `transactions`, `missions`, `mission_completions`,
`redemption_requests`, `redemption_categories`, `mentors`, `referrals`,
`achievements`, `user_achievements`, `admin_audit_log`, `states`,
`mission_unlocks`, `promo_codes`, `raffles`, `raffle_entries`, `weekly_mvps`,
`featured_dreamers`, `dream_pairs`, `magic_boxes`, `magic_box_entries`,
`support_campaigns`, `support_contributions`, `ads`, `app_errors`.

Any table not on this list 404s — adding a new one requires editing
`TABLE_ALLOWLIST` in `supabase/functions/agent-api/index.ts` and redeploying, so a
future sensitive table is never exposed by accident.

## Error telemetry (`app_errors`)

Frontend errors (React render errors, failed queries/mutations, unhandled
exceptions) are now captured automatically via `log_client_error` and land in
`app_errors`, tied to the acting user when their identity was resolvable at the
time. Query it like any other table:

```sh
curl -H "X-Agent-Api-Key: $KEY" \
  "https://<ref>.supabase.co/functions/v1/agent-api/table/app_errors?user_id=<uuid>&order=occurred_at.desc"
```

`source` is one of `frontend_render`, `frontend_query`, `frontend_mutation`,
`frontend_unhandled`. Edge-function-side error capture isn't wired up yet — a
follow-up, not covered here.
