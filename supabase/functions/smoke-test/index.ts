import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

// ============================================================
// SMOKE TEST — run after every migration + frontend deploy.
// ------------------------------------------------------------
// Constructs a genuinely-signed Telegram initData for a dedicated
// test account (telegram_id 999999999, never a real user) and
// exercises the identity gateway + a sample of RPCs end-to-end
// against whatever is *actually live* right now — catching the
// exact class of bug that caused tonight's outages: a migration
// and the deployed frontend disagreeing about an RPC's signature.
//
// Every call here is either read-only or uses a deliberately
// invalid target id, so nothing here should ever mutate real data
// or the test account's own state beyond its own upsert.
//
// Protected by X-Smoke-Test-Secret (set via `supabase secrets set`)
// so this permanent, always-deployed endpoint can't be hit by
// randoms who find the URL.
// ============================================================

const enc = new TextEncoder();
async function hmac(keyBytes: Uint8Array, data: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
}
function toHex(b: Uint8Array): string {
  return Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join("");
}

const PUBLISHABLE_KEY = "sb_publishable__3831BxiVgShV0a8c16pVQ_O-MsibMS";
const TEST_TELEGRAM_ID = 999999999;
const NIL_UUID = "00000000-0000-0000-0000-000000000000";

serve(async (req) => {
  const smokeSecret = Deno.env.get("SMOKE_TEST_SECRET");
  if (!smokeSecret || req.headers.get("X-Smoke-Test-Secret") !== smokeSecret) {
    return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), { status: 403 });
  }

  const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  if (!botToken || !supabaseUrl) {
    return new Response(JSON.stringify({ ok: false, error: "missing env" }), { status: 500 });
  }

  const secretKey = await hmac(enc.encode("WebAppData"), botToken);
  const authDate = Math.floor(Date.now() / 1000).toString();
  const user = JSON.stringify({ id: TEST_TELEGRAM_ID, first_name: "SMOKE_TEST_DO_NOT_USE", username: "smoketest_dreamerdash", language_code: "en" });
  const fields: Record<string, string> = { auth_date: authDate, query_id: "AAHsmoketest", user };
  const dcs = Object.keys(fields).sort().map((k) => `${k}=${fields[k]}`).join("\n");
  const hash = toHex(await hmac(secretKey, dcs));
  const initData = [...Object.entries(fields), ["hash", hash]].map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&");

  const call = async (fn: string, extra: Record<string, unknown> = {}) => {
    const started = Date.now();
    try {
      const res = await fetch(`${supabaseUrl}/rest/v1/rpc/${fn}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: PUBLISHABLE_KEY, Authorization: `Bearer ${PUBLISHABLE_KEY}` },
        body: JSON.stringify({ p_init_data: initData, ...extra }),
      });
      const body = await res.text();
      return { fn, ms: Date.now() - started, http_status: res.status, body };
    } catch (err) {
      return { fn, ms: Date.now() - started, http_status: 0, body: String(err) };
    }
  };

  // Each check: what a HEALTHY response looks like. Any RPC-not-found /
  // signature error / permission error surfaces here as an unexpected shape.
  // upsert_telegram_user runs first and awaited alone -- on a cold start
  // (test account doesn't exist yet) every other RPC's app_user() lookup
  // would otherwise race its INSERT.
  const first = await call("upsert_telegram_user");                                        // expect: 200, user row JSON
  const rest = await Promise.all([
    call("get_me"),                                                                        // expect: 200, user row JSON
    call("transfer_dr", { p_recipient_username: "__smoke_test_nonexistent__", p_amount: 10 }), // expect: 200, {success:false, error:"Recipient not found..."}
    call("submit_contribution", { p_campaign_id: NIL_UUID, p_amount: 10, p_proof_url: "https://example.com" }), // expect: 200, {success:false, error:"Campaign not found..."}
    call("open_magic_box", { p_box_id: NIL_UUID }),                                          // expect: 200, {success:false, error:"Box not found..."}
    call("request_pair_extension", { p_pair_id: NIL_UUID }),                                 // expect: 200, {success:false, error:"Pair not found"}
  ]);
  const checks = [first, ...rest];

  // A check "fails" only if the HTTP layer itself errored (RPC missing,
  // permission denied, signature rejected) -- not on expected business-logic
  // failures like "not found", which prove the call reached real logic.
  const failed = checks.filter((c) => c.http_status !== 200);

  return new Response(
    JSON.stringify({ ok: failed.length === 0, failed_count: failed.length, checks }, null, 2),
    { status: failed.length === 0 ? 200 : 500, headers: { "Content-Type": "application/json" } }
  );
});
