import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

// ============================================================
// AGENT API — read-only reporting API for external tooling (not the
// Telegram Mini App). Separate auth model on purpose: the Telegram
// identity gateway (see SECURITY_REMEDIATION.md) proves "which Telegram
// user is this", which doesn't apply here — the caller is trusted
// software, not a Telegram session. So this uses one static bearer key
// instead, same pattern as X-Cron-Secret / X-Smoke-Test-Secret.
//
// Everything here is SELECT-only against a service-role client (bypasses
// RLS). No table is reachable unless it's in TABLE_ALLOWLIST below, so a
// future table doesn't get exposed by just existing.
// ============================================================

const JSON_HEADERS = { "Content-Type": "application/json" };

const TABLE_ALLOWLIST = new Set([
  "users", "activities", "activity_logs", "daily_checkins", "hackathons",
  "hackathon_registrations", "transactions", "missions", "mission_completions",
  "redemption_requests", "redemption_categories", "mentors", "referrals",
  "achievements", "user_achievements", "admin_audit_log", "states",
  "mission_unlocks", "promo_codes", "raffles", "raffle_entries",
  "weekly_mvps", "featured_dreamers", "dream_pairs", "magic_boxes",
  "magic_box_entries", "support_campaigns", "support_contributions", "ads",
  "app_errors",
]);

// Columns stripped from every response regardless of what's requested —
// the one PII group the codebase already treats as sensitive
// (see supabase/migrations/20260619_phase2_bank_pii.sql).
const DENY_COLUMNS: Record<string, string[]> = {
  users: ["bank_name", "account_number", "account_name"],
};

const RESERVED_PARAMS = new Set(["limit", "offset", "order", "select"]);
const IDENTIFIER_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

const RPC_ALLOWLIST: Record<string, (params: URLSearchParams) => { fn: string; args: Record<string, unknown> }> = {
  leaderboard: (params) => ({
    fn: "get_leaderboard",
    args: { p_limit: clampInt(params.get("limit"), 50, 1, 500) },
  }),
  "state-rankings": () => ({ fn: "get_state_rankings", args: {} }),
  "community-stats": () => ({ fn: "get_community_stats", args: {} }),
  redemptions: (params) => {
    const userId = params.get("user_id");
    if (!userId) throw new HttpError(400, "redemptions requires ?user_id=");
    return { fn: "get_user_redemptions", args: { p_user_id: userId } };
  },
};

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function clampInt(raw: string | null, fallback: number, min: number, max: number): number {
  const n = raw === null ? fallback : parseInt(raw, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function stripDenied(table: string, rows: Record<string, unknown>[]): Record<string, unknown>[] {
  const denied = DENY_COLUMNS[table];
  if (!denied || denied.length === 0) return rows;
  for (const row of rows) {
    for (const col of denied) delete row[col];
  }
  return rows;
}

function assertIdentifier(name: string, kind: string): string {
  if (!IDENTIFIER_RE.test(name)) {
    throw new HttpError(400, `invalid ${kind}: "${name}"`);
  }
  return name;
}

async function handleTables(): Promise<Response> {
  const tables = [...TABLE_ALLOWLIST].sort().map((name) => ({
    name,
    excluded_columns: DENY_COLUMNS[name] ?? [],
  }));
  return new Response(JSON.stringify({ tables }, null, 2), { headers: JSON_HEADERS });
}

// deno-lint-ignore no-explicit-any
async function handleTableRead(supabase: any, table: string, params: URLSearchParams): Promise<Response> {
  if (!TABLE_ALLOWLIST.has(table)) {
    throw new HttpError(404, `unknown table "${table}"`);
  }

  const selectParam = params.get("select");
  let selectCols = "*";
  if (selectParam) {
    const denied = new Set(DENY_COLUMNS[table] ?? []);
    const cols = selectParam.split(",").map((c) => c.trim()).filter(Boolean)
      .map((c) => assertIdentifier(c, "select column"))
      .filter((c) => !denied.has(c));
    if (cols.length === 0) throw new HttpError(400, "select resolved to no columns");
    selectCols = cols.join(",");
  }

  let query = supabase.from(table).select(selectCols);

  for (const [key, value] of params) {
    if (RESERVED_PARAMS.has(key)) continue;
    assertIdentifier(key, "filter column");
    query = query.eq(key, value);
  }

  const orderParam = params.get("order");
  if (orderParam) {
    const [col, dir] = orderParam.split(".");
    assertIdentifier(col, "order column");
    query = query.order(col, { ascending: dir !== "desc" });
  }

  const limit = clampInt(params.get("limit"), 100, 1, 500);
  const offset = clampInt(params.get("offset"), 0, 0, 1_000_000);
  query = query.range(offset, offset + limit - 1);

  const { data, error } = await query;
  if (error) throw new HttpError(500, error.message);

  const rows = stripDenied(table, data ?? []);
  return new Response(JSON.stringify({ table, count: rows.length, rows }, null, 2), { headers: JSON_HEADERS });
}

// deno-lint-ignore no-explicit-any
async function handleRpc(supabase: any, name: string, params: URLSearchParams): Promise<Response> {
  const resolver = RPC_ALLOWLIST[name];
  if (!resolver) throw new HttpError(404, `unknown rpc "${name}"`);

  const { fn, args } = resolver(params);
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new HttpError(500, error.message);

  return new Response(JSON.stringify({ rpc: name, data }, null, 2), { headers: JSON_HEADERS });
}

serve(async (req) => {
  try {
    if (req.method !== "GET") {
      throw new HttpError(405, "agent-api is read-only: GET only");
    }

    const apiKey = Deno.env.get("AGENT_API_KEY");
    if (!apiKey || req.headers.get("X-Agent-Api-Key") !== apiKey) {
      throw new HttpError(403, "Unauthorized");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")!)["default"];
    if (!supabaseUrl || !supabaseKey) {
      throw new HttpError(500, "missing env");
    }
    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);
    const parts = url.pathname.split("/").filter(Boolean);
    const idx = parts.indexOf("agent-api");
    const route = idx >= 0 ? parts.slice(idx + 1) : parts;

    if (route.length === 0 || route[0] === "tables") {
      return await handleTables();
    }
    if (route[0] === "table" && route[1]) {
      return await handleTableRead(supabase, route[1], url.searchParams);
    }
    if (route[0] === "rpc" && route[1]) {
      return await handleRpc(supabase, route[1], url.searchParams);
    }

    throw new HttpError(404, "not found");
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500;
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ ok: false, error: message }), { status, headers: JSON_HEADERS });
  }
});
