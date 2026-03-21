import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const WEBAPP_URL = "https://dist-gamma-tawny.vercel.app";
const BOT_USERNAME = "ZeroUpDreamersBot";

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("OK", { status: 200 });
  }

  try {
    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!botToken) return new Response("No token", { status: 500 });

    const supabase = createClient(supabaseUrl!, supabaseKey!);
    const update = await req.json();
    const message = update?.message;
    if (!message?.text) return new Response("OK", { status: 200 });

    const chatId = message.chat.id;
    const telegramId = message.from?.id;
    const text = message.text.trim();
    const firstName = message.from?.first_name || "Dreamer";

    // Helper to send a message
    const sendMessage = async (msg: string, replyMarkup?: object) => {
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: msg,
          parse_mode: "HTML",
          ...(replyMarkup ? { reply_markup: JSON.stringify(replyMarkup) } : {}),
        }),
      });
    };

    // ========== /start ==========
    if (text.startsWith("/start")) {
      const startParam = text.split(" ")[1] || "";
      const webappUrl = startParam
        ? `${WEBAPP_URL}?tgWebAppStartParam=${startParam}`
        : WEBAPP_URL;

      const coverUrl = "https://res.cloudinary.com/dckgjhlsq/image/upload/v1774116926/dreamer-dash/start-cover.png";

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

      if (!photoRes.ok) {
        await sendMessage(
          `Welcome to <b>Dreamer Dash</b>, ${firstName}! 🌟\n\nTap the button below to start earning!`,
          { inline_keyboard: [[ { text: "🚀 Start Earning", web_app: { url: WEBAPP_URL } } ]] }
        );
      }
    }

    // ========== /referrallink ==========
    else if (text === "/referrallink" || text === "/referral" || text === "/invite" || text === "/ref") {
      const { data: user } = await supabase
        .from("users")
        .select("referral_code, first_name")
        .eq("telegram_id", telegramId)
        .maybeSingle();

      if (!user || !user.referral_code) {
        await sendMessage("You need to open the app first to get your referral code.\n\nTap /start to begin.");
      } else {
        const deepLink = `https://t.me/${BOT_USERNAME}?startapp=ref_${user.referral_code}`;
        await sendMessage(
          `🔗 <b>Your Referral Link</b>\n\n<code>${deepLink}</code>\n\n🏷 <b>Your Code:</b> <code>${user.referral_code}</code>\n\n📤 Share this link with friends. When they join:\n• You earn <b>100 DR</b>\n• They get <b>20 DR</b> welcome bonus\n\nTap the link above to copy it!`
        );
      }
    }

    // ========== /balance ==========
    else if (text === "/balance" || text === "/bal") {
      const { data: user } = await supabase
        .from("users")
        .select("balance, total_earned, streak, status")
        .eq("telegram_id", telegramId)
        .maybeSingle();

      if (!user) {
        await sendMessage("You haven't joined yet. Tap /start to get started!");
      } else {
        const ngnValue = user.balance * 2;
        await sendMessage(
          `💰 <b>Your Balance</b>\n\n🪙 <b>${user.balance.toLocaleString()} DR</b>\n💵 Redemption value: ₦${ngnValue.toLocaleString()}\n\n📊 Total earned: ${user.total_earned.toLocaleString()} DR\n🔥 Streak: ${user.streak} days\n🏅 Tier: ${user.status}`,
          { inline_keyboard: [[ { text: "📱 Open App", web_app: { url: WEBAPP_URL } } ]] }
        );
      }
    }

    // ========== /help ==========
    else if (text === "/help" || text === "/commands") {
      await sendMessage(
        `📋 <b>Available Commands</b>\n\n/start — Welcome message & open app\n/referrallink — Get your referral link & code\n/balance — Check your DR balance & stats\n/help — Show this help message\n\n💡 You can also just tap the <b>Open App</b> button below to access everything!`,
        { inline_keyboard: [[ { text: "📱 Open App", web_app: { url: WEBAPP_URL } } ]] }
      );
    }

    // ========== Unknown command ==========
    else if (text.startsWith("/")) {
      await sendMessage(
        `I don't recognize that command. Try /help to see available commands.`,
        { inline_keyboard: [[ { text: "📱 Open App", web_app: { url: WEBAPP_URL } } ]] }
      );
    }

    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error(err);
    return new Response("Error", { status: 500 });
  }
});
