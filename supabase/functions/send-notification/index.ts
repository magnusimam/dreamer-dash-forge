import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createHmac } from "https://deno.land/std@0.177.0/node/crypto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Validate the signed Telegram initData (HMAC-SHA256 with the bot token).
// Ensures only authenticated Mini App users can trigger notifications —
// closing the "anyone with the public anon key can spam any user" hole.
function validateInitData(initData: string | undefined, botToken: string): boolean {
  if (!initData) return false;
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return false;
  params.delete("hash");
  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
  const computed = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
  if (computed !== hash) return false;
  const authDate = parseInt(params.get("auth_date") || "0");
  if (Math.floor(Date.now() / 1000) - authDate > 86400) return false;
  return true;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    if (!botToken) {
      return new Response(
        JSON.stringify({ ok: false, error: "Bot token not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { initData, telegram_id, message, photo_url, parse_mode } = await req.json();

    if (!validateInitData(initData, botToken)) {
      return new Response(
        JSON.stringify({ ok: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!telegram_id || (!message && !photo_url)) {
      return new Response(
        JSON.stringify({ ok: false, error: "Missing telegram_id or message/photo" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let res;

    if (photo_url) {
      // Send photo with caption
      res = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: telegram_id,
          photo: photo_url,
          caption: message || "",
          parse_mode: parse_mode || "HTML",
        }),
      });
    } else {
      // Send text only
      res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: telegram_id,
          text: message,
          parse_mode: parse_mode || "HTML",
        }),
      });
    }

    const data = await res.json();

    return new Response(
      JSON.stringify({ ok: data.ok, error: data.ok ? null : data.description }),
      { status: data.ok ? 200 : 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
