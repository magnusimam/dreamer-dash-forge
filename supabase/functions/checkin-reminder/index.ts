import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const WEBAPP_URL = "https://dist-gamma-tawny.vercel.app";

serve(async (req) => {
  try {
    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!botToken || !supabaseUrl || !supabaseKey) {
      return new Response(
        JSON.stringify({ ok: false, error: "Missing env vars" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Determine reminder type from request body (or default to "evening")
    let reminderType = "evening";
    try {
      const body = await req.json();
      if (body?.type === "urgent") reminderType = "urgent";
    } catch {
      // No body or invalid JSON — default to "evening"
    }

    const today = new Date().toISOString().split("T")[0];

    // Get all users who have NOT checked in today
    // Left join users with today's checkins and filter for those with no checkin
    const { data: users, error: usersError } = await supabase
      .from("users")
      .select("telegram_id, first_name, streak");

    if (usersError) throw usersError;
    if (!users || users.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, sent: 0, message: "No users found" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // Get all user IDs who already checked in today
    const { data: checkins, error: checkinError } = await supabase
      .from("daily_checkins")
      .select("user_id")
      .eq("check_in_date", today);

    if (checkinError) throw checkinError;

    const checkedInIds = new Set((checkins || []).map((c: any) => c.user_id));

    // Filter to users who haven't checked in
    // Note: daily_checkins uses user_id (uuid), but we fetched users without id
    // We need the user id to cross-reference. Let me fetch id too.
    const { data: allUsers, error: allUsersError } = await supabase
      .from("users")
      .select("id, telegram_id, first_name, streak");

    if (allUsersError) throw allUsersError;

    const uncheckedUsers = (allUsers || []).filter(
      (u: any) => !checkedInIds.has(u.id)
    );

    if (uncheckedUsers.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, sent: 0, message: "All users already checked in" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    let sent = 0;
    let failed = 0;

    for (const user of uncheckedUsers) {
      const name = user.first_name || "Dreamer";
      const streak = user.streak || 0;

      let message: string;

      if (reminderType === "urgent") {
        message = streak > 0
          ? `\u23f0 <b>Last Chance, ${name}!</b>\n\nYou have just <b>2 hours left</b> to claim your daily check-in!\n\n\ud83d\udd25 Your <b>${streak}-day streak</b> is on the line \u2014 don't let it reset!\n\nTap below to check in now.`
          : `\u23f0 <b>Last Chance, ${name}!</b>\n\nYou have just <b>2 hours left</b> to claim your daily check-in reward!\n\n\ud83e\uddbe Start building your streak today.\n\nTap below to check in now.`;
      } else {
        message = streak > 0
          ? `\u2615 <b>Hey ${name}!</b>\n\nYou haven't claimed your daily reward yet today.\n\n\ud83d\udd25 Your current streak: <b>${streak} days</b>\n\ud83c\udfaf Don't break it! Check in now to keep it going.\n\nTap below to open the app.`
          : `\u2615 <b>Hey ${name}!</b>\n\nYou haven't claimed your daily reward yet today.\n\n\ud83e\uddbe Check in to start building your streak and earn free DR!\n\nTap below to open the app.`;
      }

      try {
        const res = await fetch(
          `https://api.telegram.org/bot${botToken}/sendMessage`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: user.telegram_id,
              text: message,
              parse_mode: "HTML",
              reply_markup: JSON.stringify({
                inline_keyboard: [
                  [{ text: "\u2705 Check In Now", web_app: { url: WEBAPP_URL } }],
                ],
              }),
            }),
          }
        );

        const result = await res.json();
        if (result.ok) {
          sent++;
        } else {
          failed++;
        }
      } catch {
        failed++;
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        type: reminderType,
        total_users: allUsers?.length ?? 0,
        already_checked_in: checkedInIds.size,
        reminders_sent: sent,
        failed,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
