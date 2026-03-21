import { supabase } from "./supabase";

/**
 * Send an in-chat Telegram message to a user via the bot.
 * Fires and forgets — does not block the UI.
 * Optionally include a photo URL to send as image with caption.
 */
export function notifyUser(telegramId: number, message: string, photoUrl?: string) {
  supabase.functions
    .invoke("send-notification", {
      body: { telegram_id: telegramId, message, photo_url: photoUrl || undefined },
    })
    .catch(() => {
      // Silent fail — notifications are best-effort
    });
}

// ============================================================
// Pre-built notification templates
// ============================================================

export function notifyReferralBonus(telegramId: number, referrerName: string) {
  notifyUser(
    telegramId,
    `🎉 <b>Referral Bonus!</b>\n\nSomeone joined using your referral code! You've earned <b>+100 DR</b>.\n\nKeep sharing your code to earn more!`
  );
}

export function notifyReferralWelcome(telegramId: number) {
  notifyUser(
    telegramId,
    `👋 <b>Welcome to Dreamer Dash!</b>\n\nYou've been referred and earned <b>+20 DR</b> as a welcome bonus.\n\nOpen the app to start earning more!`
  );
}

export function notifyEarning(telegramId: number, amount: number, source: string) {
  notifyUser(
    telegramId,
    `💰 <b>+${amount} DR earned!</b>\n\n${source}\n\nYour balance has been updated.`
  );
}

export function notifyTransferReceived(telegramId: number, amount: number, senderName: string, note?: string) {
  const noteText = note ? `\n\n📝 Note: ${note}` : "";
  notifyUser(
    telegramId,
    `💸 <b>Transfer Received!</b>\n\n<b>+${amount} DR</b> from @${senderName}${noteText}\n\nOpen the app to check your balance.`
  );
}

export function notifyRedemptionUpdate(telegramId: number, category: string, status: string, notes?: string) {
  const emoji = status === "approved" ? "✅" : "❌";
  const noteText = notes ? `\n\n📝 Admin note: ${notes}` : "";
  notifyUser(
    telegramId,
    `${emoji} <b>Redemption ${status}!</b>\n\nYour <b>${category}</b> redemption request has been <b>${status}</b>.${status === "rejected" ? "\n\nYour DR has been refunded." : ""}${noteText}`
  );
}

export function notifyAchievement(telegramId: number, title: string, reward: number) {
  notifyUser(
    telegramId,
    `🏆 <b>Achievement Unlocked!</b>\n\n<b>${title}</b>\n\n+${reward} DR reward credited!\n\nOpen the app to see your achievements.`
  );
}

export function notifyDailyCheckin(telegramId: number, reward: number, streak: number) {
  notifyUser(
    telegramId,
    `☀️ <b>Daily Check-in!</b>\n\n+${reward} DR earned\n🔥 Streak: ${streak} days\n\nKeep it going!`
  );
}

export function notifyHackathonRegistered(telegramId: number, hackathonTitle: string, feePaid: number) {
  notifyUser(
    telegramId,
    `🚀 <b>Registered for Hackathon!</b>\n\n<b>${hackathonTitle}</b>\n\n${feePaid > 0 ? `Entry fee: ${feePaid} DR deducted.` : "Free entry!"}\n\nGood luck!`
  );
}

export function notifyProofApproved(telegramId: number, activityTitle: string, reward: number) {
  notifyUser(
    telegramId,
    `✅ <b>Proof Approved!</b>\n\nYour proof for <b>${activityTitle}</b> was approved.\n\n+${reward} DR credited!`
  );
}

export function notifyProofRejected(telegramId: number, activityTitle: string) {
  notifyUser(
    telegramId,
    `❌ <b>Proof Rejected</b>\n\nYour proof for <b>${activityTitle}</b> was not accepted.\n\nPlease try again with a clearer screenshot.`
  );
}
