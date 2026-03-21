import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const WEBAPP_URL = "https://dist-gamma-tawny.vercel.app";

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("OK", { status: 200 });
  }

  try {
    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    if (!botToken) return new Response("No token", { status: 500 });

    const update = await req.json();
    const message = update?.message;
    if (!message?.text) return new Response("OK", { status: 200 });

    const chatId = message.chat.id;
    const text = message.text;
    const firstName = message.from?.first_name || "Dreamer";

    // Handle /start command
    if (text.startsWith("/start")) {
      const startParam = text.split(" ")[1] || "";
      const webappUrl = startParam
        ? `${WEBAPP_URL}?tgWebAppStartParam=${startParam}`
        : WEBAPP_URL;

      // Send cover photo with caption
      const coverUrl = "https://res.cloudinary.com/dckgjhlsq/image/upload/v1774114669/dreamer-dash/app-cover.jpg";

      // Try sending photo first
      const photoRes = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          photo: coverUrl,
          caption: `Welcome to <b>Dreamer Dash</b>, ${firstName}! 🌟\n\nThe official rewards platform for the Dreamers community by ZeroUp Initiative.\n\n🪙 <b>Earn</b> Dreamers Coins (DR) through activities, daily check-ins, missions, and referrals\n\n🎁 <b>Redeem</b> DR for airtime, data, cash, books, courses, and mentorship\n\n🚀 <b>Compete</b> in hackathons, climb the leaderboard, and level up from Bronze to Diamond\n\n💰 1 DR = ₦2 | 21M total supply | Transparent & community-powered\n\nTap the button below to start earning!`,
          parse_mode: "HTML",
          reply_markup: JSON.stringify({
            inline_keyboard: [[
              { text: "🚀 Start Earning", web_app: { url: webappUrl } }
            ]]
          }),
        }),
      });

      // If photo fails (no cover uploaded yet), send text only
      if (!photoRes.ok) {
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: `Welcome to <b>Dreamer Dash</b>, ${firstName}! 🌟\n\nThe official rewards platform for the Dreamers community by ZeroUp Initiative.\n\n🪙 <b>Earn</b> Dreamers Coins (DR) through activities, daily check-ins, missions, and referrals\n\n🎁 <b>Redeem</b> DR for airtime, data, cash, books, courses, and mentorship\n\n🚀 <b>Compete</b> in hackathons, climb the leaderboard, and level up from Bronze to Diamond\n\n💰 1 DR = ₦2 | 21M total supply | Transparent & community-powered\n\nTap the button below to start earning!`,
            parse_mode: "HTML",
            reply_markup: JSON.stringify({
              inline_keyboard: [[
                { text: "🚀 Start Earning", web_app: { url: webappUrl } }
              ]]
            }),
          }),
        });
      }
    }

    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error(err);
    return new Response("Error", { status: 500 });
  }
});
