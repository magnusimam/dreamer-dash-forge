import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight, Share2, Copy, Check,
  Flame, Sparkles, TrendingUp, Loader2, MapPin, Shield, BookOpen, Gift, X, Cake, Coins, GraduationCap, Send,
} from "lucide-react";
import BalanceCard from "@/components/BalanceCard";
import TransactionList from "@/components/TransactionList";
import { useTransactions, useTodayCheckin, usePerformCheckin, useStateRankings, useBuyStreakInsurance, useTodaysBirthdays, isUserOnline, useFeaturedDreamer, getDreamerLevel, useCommunityStats, useTransferDR } from "@/hooks/useSupabase";
import UserProfileModal from "@/components/UserProfileModal";
import { useTelegram } from "@/contexts/TelegramContext";
import { useUser } from "@/contexts/UserContext";
import { useToast } from "@/hooks/use-toast";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { hapticNotification } from "@/lib/telegram";
import { notifyDailyCheckin, notifyUser } from "@/lib/notifications";
import { supabase } from "@/lib/supabase";
import { Confetti } from "@/components/Confetti";
import { supabase } from "@/lib/supabase";

interface HomeProps {
  onTabChange: (tab: string) => void;
}

const BOT_USERNAME = "ZeroUpDreamersBot";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

const tierColors: Record<string, string> = {
  Bronze: "bg-amber-700/20 text-amber-500 border-amber-700/30",
  Silver: "bg-gray-300/20 text-gray-300 border-gray-300/30",
  Gold: "bg-primary/20 text-primary border-primary/30",
  Diamond: "bg-cyan-400/20 text-cyan-400 border-cyan-400/30",
};

export default function Home({ onTabChange }: HomeProps) {
  const { user } = useTelegram();
  const { dbUser } = useUser();
  const { data: recentTransactions = [] } = useTransactions(3);
  const { data: alreadyCheckedIn = false } = useTodayCheckin();
  const checkinMutation = usePerformCheckin();
  const streakInsuranceMutation = useBuyStreakInsurance();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const { data: todaysBirthdays = [] } = useTodaysBirthdays();
  const { data: featuredDreamer } = useFeaturedDreamer();
  const [viewProfileUserId, setViewProfileUserId] = useState<string | null>(null);
  const transferMutation = useTransferDR();
  const [showConvoGift, setShowConvoGift] = useState(false);
  const [convoGiftAmount, setConvoGiftAmount] = useState("");
  const [convoGiftRecipient, setConvoGiftRecipient] = useState<string | null>(null);
  const [showConvoBanner, setShowConvoBanner] = useState(() => {
    const dismissed = localStorage.getItem("convo_banner_dismissed_20260410");
    return !dismissed;
  });

  // Convocation celebrants — update names/usernames here
  const convoCelebrants = [
    { name: "Etura", username: "Etura01" },
    { name: "Fega", username: "Ale_xa31" },
  ];
  const queryClient = useQueryClient();
  const { data: stateRankings = [] } = useStateRankings();
  const topState = stateRankings[0] || null;

  usePullToRefresh(async () => { await queryClient.invalidateQueries(); });

  const balance = dbUser?.balance ?? 0;
  const streak = dbUser?.streak ?? 0;
  const status = dbUser?.status ?? "Bronze";
  const totalEarned = dbUser?.total_earned ?? 0;
  const firstName = user?.firstName ?? "Dreamer";
  const initials = user
    ? [user.firstName?.[0], user.lastName?.[0]].filter(Boolean).join("")
    : "DR";

  // Inactivity warning
  const daysSinceCheckin = dbUser?.last_check_in
    ? Math.floor((Date.now() - new Date(dbUser.last_check_in).getTime()) / 86400000)
    : null;

  // Progress nudge
  const tierThresholds = [
    { tier: "Silver", threshold: 5000 },
    { tier: "Gold", threshold: 20000 },
    { tier: "Diamond", threshold: 50000 },
  ];
  const nextTier = tierThresholds.find((t) => totalEarned < t.threshold);
  const drToNext = nextTier ? nextTier.threshold - totalEarned : 0;
  const daysToStreakBonus = streak > 0 ? 7 - (streak % 7) : 7;

  const handleQuickCheckin = async () => {
    try {
      const result = await checkinMutation.mutateAsync();
      if (result?.success) {
        hapticNotification("success");
        setShowConfetti(true);
        toast({ title: "Daily Check-in!", description: `+${result.reward} DR. Streak: ${result.streak} days!` });
        if (dbUser?.telegram_id) notifyDailyCheckin(dbUser.telegram_id, result.reward, result.streak);
      } else {
        toast({ title: "Check-in failed", description: result?.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Check-in failed.", variant: "destructive" });
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="pb-28 px-4 pt-6"
    >
      {/* Header — Avatar + Greeting + Streak */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 -mx-4 -mt-6 px-4 pt-6 pb-4"
        style={{
          background: "linear-gradient(180deg, hsl(45 100% 50% / 0.06) 0%, transparent 100%)",
          borderBottom: "1px solid hsl(45 100% 50% / 0.08)",
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Avatar className="w-11 h-11 border-2 border-primary/30">
                <AvatarImage src={user?.photoUrl} />
                <AvatarFallback className="bg-primary/20 text-primary font-bold text-sm">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-card bg-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-foreground">
                  {getGreeting()}, {firstName}
                </h1>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge className={`text-[10px] px-1.5 py-0 h-4 ${tierColors[status] || tierColors.Bronze}`}>
                  {status}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  Keep earning Dreamers Coins
                </span>
              </div>
            </div>
          </div>

          {/* Streak */}
          {streak > 0 && (
            <div className="flex flex-col items-center">
              <div className="flex items-center gap-1 bg-orange-500/15 rounded-lg px-2.5 py-1.5">
                <Flame className="w-4 h-4 text-orange-400" />
                <span className="text-orange-400 font-bold text-sm">{streak}</span>
              </div>
              <span className="text-[10px] text-muted-foreground mt-0.5">streak</span>
            </div>
          )}
        </div>
      </motion.div>

      {/* Inactivity Warning */}
      {daysSinceCheckin !== null && daysSinceCheckin >= 5 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-4">
          <Card className={`p-3 ${daysSinceCheckin >= 30 ? "border-destructive/50 bg-destructive/10" : daysSinceCheckin >= 10 ? "border-red-500/30 bg-red-500/10" : "border-orange-500/30 bg-orange-500/10"}`}>
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${daysSinceCheckin >= 30 ? "bg-destructive/20" : daysSinceCheckin >= 10 ? "bg-red-500/20" : "bg-orange-500/20"}`}>
                <span className="text-lg">{daysSinceCheckin >= 30 ? "🚨" : daysSinceCheckin >= 10 ? "⚠️" : "⏰"}</span>
              </div>
              <div className="flex-1">
                {daysSinceCheckin >= 30 ? (
                  <>
                    <p className="text-sm font-semibold text-destructive">Account at Risk!</p>
                    <p className="text-xs text-muted-foreground">{daysSinceCheckin} days inactive. -200 DR penalty applied. Your account may be flagged for deletion.</p>
                  </>
                ) : daysSinceCheckin >= 10 ? (
                  <>
                    <p className="text-sm font-semibold text-red-400">Inactivity Penalty!</p>
                    <p className="text-xs text-muted-foreground">{daysSinceCheckin} days without check-in. -200 DR deducted. Check in now to stop losing DR!</p>
                  </>
                ) : daysSinceCheckin >= 7 ? (
                  <>
                    <p className="text-sm font-semibold text-orange-400">Inactivity Warning!</p>
                    <p className="text-xs text-muted-foreground">{daysSinceCheckin} days without check-in. -50 DR deducted. Check in daily to keep your DR safe!</p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-semibold text-orange-400">Check In Soon!</p>
                    <p className="text-xs text-muted-foreground">{daysSinceCheckin} days without check-in. Penalties start at 7 days!</p>
                  </>
                )}
              </div>
            </div>
          </Card>
        </motion.div>
      )}

      {/* Convocation Celebration Banner */}
      {showConvoBanner && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="mb-4">
          <Card className="border-purple-500/30 bg-gradient-to-r from-purple-500/15 to-pink-500/15 p-4 relative overflow-hidden">
            <Button size="icon" variant="ghost" className="absolute top-2 right-2 h-6 w-6" onClick={() => { setShowConvoBanner(false); localStorage.setItem("convo_banner_dismissed_20260410", "true"); }}>
              <X className="w-3 h-3" />
            </Button>
            <div className="text-center mb-3">
              <GraduationCap className="w-8 h-8 text-purple-400 mx-auto mb-2" />
              <h3 className="text-lg font-bold text-foreground">Congratulations!</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Today is <span className="text-purple-400 font-semibold">{convoCelebrants.map(c => c.name).join(" & ")}</span>'s Convocation!
              </p>
              <p className="text-xs text-muted-foreground">Celebrate them with some Dreamers Coins!</p>
            </div>
            <Button className="w-full bg-purple-600 hover:bg-purple-700 text-white" onClick={() => setShowConvoGift(true)}>
              <Gift className="w-4 h-4 mr-2" /> Gift DR to Celebrate
            </Button>
          </Card>
        </motion.div>
      )}

      {/* Convocation Gift Modal */}
      <AnimatePresence>
        {showConvoGift && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-end justify-center" onClick={() => setShowConvoGift(false)}>
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 300 }} className="w-full max-w-md bg-card border-t border-border rounded-t-2xl p-6 pb-16" onClick={(e) => e.stopPropagation()}>
              <div className="w-10 h-1 bg-border rounded-full mx-auto mb-4" />
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-foreground text-lg flex items-center gap-2"><GraduationCap className="w-5 h-5 text-purple-400" /> Gift a Graduate</h3>
                <Button size="icon" variant="ghost" onClick={() => setShowConvoGift(false)}><X className="w-4 h-4" /></Button>
              </div>

              <p className="text-xs text-muted-foreground mb-4">Who would you like to gift?</p>
              <div className="flex gap-2 mb-4">
                {convoCelebrants.map((c) => (
                  <Button key={c.username} variant={convoGiftRecipient === c.username ? "default" : "outline"} className={`flex-1 ${convoGiftRecipient === c.username ? "bg-purple-600 text-white" : "border-purple-500/30 text-purple-400"}`} onClick={() => setConvoGiftRecipient(c.username)}>
                    <GraduationCap className="w-3.5 h-3.5 mr-1.5" /> {c.name}
                  </Button>
                ))}
              </div>

              <p className="text-xs text-muted-foreground mb-2">How much DR?</p>
              <div className="flex gap-2 mb-3">
                {[10, 25, 50, 100].map((val) => (
                  <Button key={val} size="sm" variant="outline" className={`flex-1 ${convoGiftAmount === String(val) ? "border-primary bg-primary/10 text-primary" : "border-border"}`} onClick={() => setConvoGiftAmount(String(val))}>
                    {val}
                  </Button>
                ))}
              </div>
              <Input type="number" placeholder="Or enter custom amount" value={convoGiftAmount} onChange={(e) => setConvoGiftAmount(e.target.value)} className="mb-4 bg-secondary border-border text-center text-lg font-semibold" />

              <Button className="w-full bg-purple-600 hover:bg-purple-700 text-white" disabled={!convoGiftRecipient || !convoGiftAmount || parseInt(convoGiftAmount) < 5 || transferMutation.isPending}
                onClick={async () => {
                  try {
                    const result = await transferMutation.mutateAsync({
                      recipientUsername: convoGiftRecipient!,
                      amount: parseInt(convoGiftAmount),
                      note: "Happy Convocation!",
                    });
                    if (result?.success) {
                      hapticNotification("success");
                      setShowConfetti(true);
                      toast({ title: "Gift Sent!", description: `${result.amount} DR sent to ${result.recipient}. Happy Convocation!` });
                      // Notify recipient
                      const { data: recipient } = await supabase.from("users").select("telegram_id").ilike("username", convoGiftRecipient!).maybeSingle();
                      if (recipient?.telegram_id) {
                        const senderName = [dbUser?.first_name, dbUser?.last_name].filter(Boolean).join(" ");
                        notifyUser(recipient.telegram_id, `🎓🎉 <b>Convocation Gift!</b>\n\n<b>${senderName}</b> just sent you <b>${result.amount} DR</b> to celebrate your Convocation!\n\nCongratulations! 🎊`);
                      }
                      setShowConvoGift(false);
                      setConvoGiftAmount("");
                      setConvoGiftRecipient(null);
                    } else {
                      hapticNotification("error");
                      toast({ title: "Failed", description: result?.error, variant: "destructive" });
                    }
                  } catch (err: any) {
                    hapticNotification("error");
                    toast({ title: "Error", description: err?.message || "Transfer failed", variant: "destructive" });
                  }
                }}>
                {transferMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                Send {convoGiftAmount || "0"} DR
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quick Check-in Banner */}
      {!alreadyCheckedIn && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.05 }}
          className="mb-4"
        >
          <Card className="border-primary/30 bg-primary/5 p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Daily Check-in</p>
                  <p className="text-xs text-muted-foreground">Claim +25 DR now</p>
                </div>
              </div>
              <Button
                size="sm"
                className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-glow h-8"
                onClick={handleQuickCheckin}
                disabled={checkinMutation.isPending}
              >
                {checkinMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Claim"}
              </Button>
            </div>
          </Card>
        </motion.div>
      )}

      {/* Streak Insurance */}
      {streak >= 2 && !alreadyCheckedIn && !dbUser?.streak_protected_until && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-4">
          <Card className="border-orange-500/20 bg-orange-500/5 p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-orange-500/15 flex items-center justify-center">
                  <Shield className="w-4 h-4 text-orange-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Protect Streak</p>
                  <p className="text-xs text-muted-foreground">Keep your {streak}-day streak safe — 50 DR</p>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="border-orange-500/30 text-orange-400 hover:bg-orange-500/10 h-8"
                onClick={async () => {
                  const result = await streakInsuranceMutation.mutateAsync();
                  if (result?.success) {
                    hapticNotification("success");
                    toast({ title: "Streak Protected!", description: `Your ${result.streak}-day streak is safe until tomorrow.` });
                  } else {
                    hapticNotification("error");
                    toast({ title: "Failed", description: result?.error, variant: "destructive" });
                  }
                }}
                disabled={streakInsuranceMutation.isPending || balance < 50}
              >
                {streakInsuranceMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Shield className="w-3 h-3 mr-1" />}
                50 DR
              </Button>
            </div>
          </Card>
        </motion.div>
      )}

      {/* Featured Dreamer Spotlight */}
      {featuredDreamer && featuredDreamer.id !== dbUser?.id && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-4">
          <Card className="border-yellow-500/20 bg-gradient-to-r from-yellow-500/5 to-primary/5 p-3 cursor-pointer" onClick={() => setViewProfileUserId(featuredDreamer.id)}>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Avatar className="w-10 h-10 border-2 border-yellow-400/50">
                  <AvatarImage src={featuredDreamer.photo_url} />
                  <AvatarFallback className="text-xs">{featuredDreamer.first_name?.[0]}</AvatarFallback>
                </Avatar>
                <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-card ${isUserOnline(featuredDreamer.last_active) ? "bg-emerald-400" : "bg-muted-foreground/30"}`} />
              </div>
              <div className="flex-1">
                <p className="text-[10px] text-yellow-400 font-medium uppercase tracking-wider">Featured Dreamer</p>
                <p className="text-sm font-semibold text-foreground">{featuredDreamer.first_name} {featuredDreamer.last_name || ""}</p>
                <p className="text-[10px] text-muted-foreground">{featuredDreamer.status} · {featuredDreamer.streak} day streak</p>
              </div>
              <Sparkles className="w-5 h-5 text-yellow-400 shrink-0" />
            </div>
          </Card>
        </motion.div>
      )}


      {/* Birthday Banner */}
      {todaysBirthdays.filter((u: any) => u.id !== dbUser?.id).length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-4">
          <Card className="border-pink-500/20 bg-gradient-to-r from-pink-500/10 to-purple-500/10 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Cake className="w-5 h-5 text-pink-400" />
              <p className="text-sm font-semibold text-foreground">Happy Birthday!</p>
            </div>
            <div className="space-y-2">
              {todaysBirthdays.filter((u: any) => u.id !== dbUser?.id).map((u: any) => (
                <div key={u.id} className="flex items-center justify-between">
                  <button className="flex items-center gap-2 text-left" onClick={() => setViewProfileUserId(u.id)}>
                    <div className="relative">
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={u.photo_url} />
                        <AvatarFallback className="bg-pink-500/20 text-pink-400 text-xs">
                          {[u.first_name?.[0], u.last_name?.[0]].filter(Boolean).join("")}
                        </AvatarFallback>
                      </Avatar>
                      <span className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-card ${isUserOnline(u.last_active) ? "bg-emerald-400" : "bg-muted-foreground/30"}`} />
                    </div>
                    <p className="text-xs text-foreground">
                      <span className="font-medium">{u.first_name}</span> is celebrating today!
                    </p>
                  </button>
                  {onTabChange && (
                    <Button size="sm" className="bg-pink-600 hover:bg-pink-700 text-white h-7 text-xs" onClick={() => onTabChange("transfer")}>
                      <Coins className="w-3 h-3 mr-1" /> Gift DR
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </motion.div>
      )}

      {/* User Profile Modal */}
      {viewProfileUserId && (
        <UserProfileModal
          userId={viewProfileUserId}
          onClose={() => setViewProfileUserId(null)}
          onTransfer={onTabChange ? () => onTabChange("transfer") : undefined}
        />
      )}

      {/* Balance Card */}
      <BalanceCard balance={balance} dailyEarnings={streak ? streak * 25 : 0} />

      {/* Progress Nudge */}
      {nextTier && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="mb-4 -mt-4"
        >
          <div className="flex items-center gap-2 px-1">
            <TrendingUp className="w-3 h-3 text-primary flex-shrink-0" />
            <p className="text-xs text-muted-foreground">
              {drToNext.toLocaleString()} DR to <span className="text-foreground font-medium">{nextTier.tier}</span>
              {daysToStreakBonus > 0 && daysToStreakBonus < 7 && (
                <> · <Flame className="w-3 h-3 text-orange-400 inline" /> {daysToStreakBonus}d to streak bonus</>
              )}
            </p>
          </div>
        </motion.div>
      )}

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="grid grid-cols-3 gap-3 mb-6"
      >
        <Button
          onClick={() => onTabChange("activities")}
          className="h-14 gradient-primary text-primary-foreground shadow-glow hover:shadow-none transition-smooth justify-center"
        >
          Earn
        </Button>
        <Button
          onClick={() => onTabChange("transfer")}
          className="h-14 gradient-primary text-primary-foreground shadow-glow hover:shadow-none transition-smooth justify-center"
        >
          Send
        </Button>
        <Button
          onClick={() => onTabChange("redeem")}
          variant="outline"
          className="h-14 border-primary/30 hover:border-primary hover:bg-primary/10"
        >
          <ArrowRight className="w-5 h-5 mr-2" />
          Redeem
        </Button>
      </motion.div>

      {/* Community & Extras */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }} className="grid grid-cols-2 gap-3 mb-6">
        <Card className="gradient-card border-border/50 p-3 cursor-pointer hover:border-primary/30 transition-smooth" onClick={() => onTabChange("community")}>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-pink-500/15 flex items-center justify-center">
              <Gift className="w-4 h-4 text-pink-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Community</p>
              <p className="text-[10px] text-muted-foreground">Gift wall & stats</p>
            </div>
          </div>
        </Card>
        <Card className="gradient-card border-border/50 p-3 cursor-pointer hover:border-primary/30 transition-smooth" onClick={() => onTabChange("supply")}>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-500/15 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">DR Supply</p>
              <p className="text-[10px] text-muted-foreground">Tokenomics</p>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* State Rankings Teaser */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="mb-6"
      >
        <Card
          className="gradient-card border-border/50 p-4 cursor-pointer hover:border-primary/30 transition-smooth"
          onClick={() => onTabChange("states")}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
                <MapPin className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">State Rankings</h3>
                <p className="text-xs text-muted-foreground">
                  {topState ? `${topState.state_name} leads with ${Number(topState.total_balance).toLocaleString()} DR` : "See which state leads"}
                </p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground" />
          </div>
        </Card>
      </motion.div>

      {/* Recent Transactions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">
            Recent Activity
          </h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onTabChange("transactions")}
            className="text-primary hover:text-primary/80"
          >
            See All
            <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </div>

        {recentTransactions.length > 0 ? (
          <TransactionList transactions={recentTransactions} />
        ) : (
          <p className="text-sm text-muted-foreground text-center py-6">
            No transactions yet. Start earning!
          </p>
        )}
      </motion.div>

      {/* Referral Share Card */}
      {dbUser?.referral_code && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-6"
        >
          <Card className="gradient-card border-border/50 p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
                <Share2 className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">Invite Friends</h3>
                <p className="text-xs text-muted-foreground">You earn 100 DR, they get 20 DR</p>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-secondary rounded-lg p-3 mb-3">
              <code className="text-sm font-mono text-foreground flex-1">{dbUser.referral_code}</code>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 px-2"
                aria-label="Copy to clipboard"
                onClick={() => {
                  navigator.clipboard.writeText(dbUser.referral_code);
                  setCopied(true);
                  toast({ title: "Copied!", description: "Referral code copied to clipboard." });
                  setTimeout(() => setCopied(false), 2000);
                }}
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-muted-foreground" />}
              </Button>
            </div>
            <Button
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-glow"
              onClick={() => {
                const deepLink = `https://t.me/${BOT_USERNAME}?startapp=ref_${dbUser.referral_code}`;
                navigator.clipboard.writeText(deepLink);
                toast({ title: "Link Copied!", description: "Share this link with your friends." });
              }}
            >
              <Share2 className="w-4 h-4 mr-2" />
              Share Invite Link
            </Button>
          </Card>
        </motion.div>
      )}

      <Confetti active={showConfetti} onComplete={() => setShowConfetti(false)} />
    </motion.div>
  );
}
