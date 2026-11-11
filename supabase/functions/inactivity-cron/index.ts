// Hourly inactivity job (triggered by pg_cron "inactivity-tick").
//
// 1. Calls cron_inactivity_tick(): applies today's inactivity penalties to
//    everyone 7+ days inactive, puts anyone who hits 0 DR on a 5-day
//    deletion watch, and resolves watches whose 5 days are up
//    (balance > 0 -> saved, else the account is deleted).
// 2. Broadcasts to the whole community over Telegram:
//    - "X's account will be deleted in 5 days — send DR to save them"
//    - "X was saved" / "X's account has been deleted"
//
// Each announcement row is claimed (announced_at set) BEFORE sending, so a
// crash mid-broadcast can never cause a double broadcast.
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const WEBAPP_URL = "https://dreamer-dash-forge.pages.dev";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const esc = (s: string | null | undefined) =>
  (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const displayName = (w: { first_name: string | null; username: string | null }) =>
  `<b>${esc(w.first_name) || "A Dreamer"}</b>${w.username ? ` (@${esc(w.username)})` : ""}`;

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", {
    timeZone: "Africa/Lagos",
    weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  }) + " WAT";

serve(async (req) => {
  // This job penalizes and deletes accounts: fail closed without the secret.
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (!cronSecret || req.headers.get("X-Cron-Secret") !== cronSecret) {
    return json({ ok: false, error: "Unauthorized" }, 403);
  }

  try {
    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")!)["default"];
    if (!botToken || !supabaseUrl || !supabaseKey) {
      return json({ ok: false, error: "Missing env vars" }, 500);
    }
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Penalties + resolve expired watches
    const { data: tick, error: tickErr } = await supabase.rpc("cron_inactivity_tick");
    if (tickErr) throw tickErr;

    // 2. Claim announcements
    const now = new Date().toISOString();
    const { data: newFlags, error: e1 } = await supabase
      .from("account_deletion_watch")
      .update({ announced_at: now })
      .is("announced_at", null)
      .eq("status", "pending")
      .select("id, first_name, username, telegram_id, days_inactive, delete_after");
    if (e1) throw e1;

    const { data: outcomes, error: e2 } = await supabase
      .from("account_deletion_watch")
      .update({ outcome_announced_at: now })
      .is("outcome_announced_at", null)
      .in("status", ["saved", "deleted"])
      .select("id, first_name, username, telegram_id, status, rescued_dr, final_balance");
    if (e2) throw e2;

    const messages: { text: string; button?: string; skipTelegramIds?: number[] }[] = [];

    // Several events in one run are combined into one message per kind, so
    // the community gets at most 3 messages per hour, not one per account.
    const flags = newFlags ?? [];
    if (flags.length === 1) {
      const w = flags[0];
      messages.push({
        text:
          `🚨 <b>Account at Risk!</b>\n\n` +
          `${displayName(w)} has been inactive for ${w.days_inactive} days and their balance is now <b>0 DR</b>.\n\n` +
          `⏳ Their account will be <b>deleted automatically on ${fmtDate(w.delete_after)}</b> (in 5 days).\n\n` +
          `💛 You can save them! Send them any amount of DR before the deadline and their account stays.\n\n` +
          `Tap below to help.`,
        button: "💛 Save Their Account",
      });
    } else if (flags.length > 1) {
      const list = flags.map((w) => `• ${displayName(w)} — ${w.days_inactive} days inactive`).join("\n");
      messages.push({
        text:
          `🚨 <b>${flags.length} Accounts at Risk!</b>\n\n` +
          `These Dreamers have hit <b>0 DR</b> from inactivity:\n\n${list}\n\n` +
          `⏳ Their accounts will be <b>deleted automatically on ${fmtDate(flags[0].delete_after)}</b> (in 5 days).\n\n` +
          `💛 You can save them! Send any of them DR before the deadline and their account stays.\n\n` +
          `Tap below to help.`,
        button: "💛 Save Their Accounts",
      });
    }

    const saved = (outcomes ?? []).filter((w) => w.status === "saved");
    const deleted = (outcomes ?? []).filter((w) => w.status === "deleted");

    if (saved.length > 0) {
      const list = saved
        .map((w) => `• ${displayName(w)}` + (w.rescued_dr > 0 ? ` — ${w.rescued_dr} DR from the community` : ""))
        .join("\n");
      messages.push({
        text:
          `🎉 <b>${saved.length === 1 ? "Account" : `${saved.length} Accounts`} Saved!</b>\n\n` +
          `Staying in the Dreamers family:\n\n${list}\n\nThank you to everyone who helped! 💛`,
      });
    }

    if (deleted.length > 0) {
      const list = deleted.map((w) => `• ${displayName(w)}`).join("\n");
      messages.push({
        text:
          `🕊️ <b>${deleted.length === 1 ? "Account" : `${deleted.length} Accounts`} Deleted</b>\n\n` +
          `Deleted after 5 days at 0 DR with no rescue:\n\n${list}\n\n` +
          `Keep checking in daily so this never happens to you!`,
        // Their accounts are gone; don't message them.
        skipTelegramIds: deleted.map((w) => w.telegram_id).filter(Boolean),
      });
    }

    // 3. Broadcast to everyone
    let sent = 0, failed = 0, recipients = 0;
    if (messages.length > 0) {
      const { data: users, error: uErr } = await supabase
        .from("users")
        .select("telegram_id")
        .neq("telegram_id", 0)
        .not("telegram_id", "is", null);
      if (uErr) throw uErr;
      recipients = users?.length ?? 0;

      for (const m of messages) {
        for (const u of users ?? []) {
          if (m.skipTelegramIds?.includes(u.telegram_id)) continue;
          try {
            const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: u.telegram_id,
                text: m.text,
                parse_mode: "HTML",
                reply_markup: JSON.stringify({
                  inline_keyboard: [[{ text: m.button ?? "Open App", web_app: { url: WEBAPP_URL } }]],
                }),
              }),
            });
            const r = await res.json();
            r.ok ? sent++ : failed++;
          } catch {
            failed++;
          }
          await new Promise((r) => setTimeout(r, 40)); // stay under Telegram's ~30 msg/s
        }
      }
    }

    return json({
      ok: true,
      tick,
      announced: { flagged: newFlags?.length ?? 0, outcomes: outcomes?.length ?? 0 },
      broadcast: { messages: messages.length, recipients, sent, failed },
    });
  } catch (err) {
    return json({ ok: false, error: String((err as Error)?.message ?? err) }, 500);
  }
});
