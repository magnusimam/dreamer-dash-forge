import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createHmac, createHash } from "https://deno.land/std@0.177.0/node/crypto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Only these upload folders may be signed.
const ALLOWED_FOLDERS = new Set(["activity-proofs", "mission-proofs", "hackathon-covers"]);

// Validate signed Telegram initData and return the verified telegram user id.
function verifiedUserId(initData: string | undefined, botToken: string): number | null {
  if (!initData) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;
  params.delete("hash");
  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
  const computed = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
  if (computed !== hash) return null;
  const authDate = parseInt(params.get("auth_date") || "0");
  if (Math.floor(Date.now() / 1000) - authDate > 86400) return null;
  try {
    const user = JSON.parse(params.get("user") || "{}");
    return typeof user.id === "number" ? user.id : null;
  } catch {
    return null;
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const apiKey = Deno.env.get("CLOUDINARY_API_KEY");
    const apiSecret = Deno.env.get("CLOUDINARY_API_SECRET");
    if (!botToken || !apiKey || !apiSecret) {
      return json({ error: "Not configured" }, 500);
    }

    const { initData, folder } = await req.json();

    const uid = verifiedUserId(initData, botToken);
    if (!uid) return json({ error: "Unauthorized" }, 401);
    if (!ALLOWED_FOLDERS.has(folder)) return json({ error: "Invalid folder" }, 400);

    // Server controls folder + public_id so a caller can't overwrite arbitrary assets.
    const timestamp = Math.floor(Date.now() / 1000);
    const fullFolder = `dreamer-dash/${folder}`;
    const publicId = `${uid}_${timestamp}`;

    // Cloudinary signature = sha1( sorted "key=value&..." of signed params + api_secret )
    const toSign = `folder=${fullFolder}&public_id=${publicId}&timestamp=${timestamp}`;
    const signature = createHash("sha1").update(toSign + apiSecret).digest("hex");

    return json({ signature, timestamp, api_key: apiKey, folder: fullFolder, public_id: publicId });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
