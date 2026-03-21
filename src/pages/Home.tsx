import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight, Zap, Share2, Copy, Check, Send,
  Flame, Sparkles, TrendingUp, Loader2,
} from "lucide-react";
import BalanceCard from "@/components/BalanceCard";
import TransactionList from "@/components/TransactionList";
import { useTransactions, useTodayCheckin, usePerformCheckin } from "@/hooks/useSupabase";
import { useTelegram } from "@/contexts/TelegramContext";
import { useUser } from "@/contexts/UserContext";
import { useToast } from "@/hooks/use-toast";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { useQueryClient } from "@tanstack/react-query";
import { hapticNotification } from "@/lib/telegram";
import { notifyDailyCheckin } from "@/lib/notifications";
import { Confetti } from "@/components/Confetti";

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
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const queryClient = useQueryClient();

  usePullToRefresh(async () => { await queryClient.invalidateQueries(); });

  const balance = dbUser?.balance ?? 0;
  const streak = dbUser?.streak ?? 0;
  const status = dbUser?.status ?? "Bronze";
  const totalEarned = dbUser?.total_earned ?? 0;
  const firstName = user?.firstName ?? "Dreamer";
  const initials = user
    ? [user.firstName?.[0], user.lastName?.[0]].filter(Boolean).join("")
    : "DR";

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
        className="mb-6"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="w-11 h-11 border-2 border-primary/30">
              <AvatarImage src={user?.photoUrl} />
              <AvatarFallback className="bg-primary/20 text-primary font-bold text-sm">
                {initials}
              </AvatarFallback>
            </Avatar>
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
          className="h-14 gradient-primary text-primary-foreground shadow-glow hover:shadow-none transition-smooth"
        >
          <Zap className="w-5 h-5 mr-2" />
          Earn
        </Button>
        <Button
          onClick={() => onTabChange("transfer")}
          className="h-14 gradient-primary text-primary-foreground shadow-glow hover:shadow-none transition-smooth"
        >
          <Send className="w-5 h-5 mr-2" />
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
                <p className="text-xs text-muted-foreground">You both earn 100 DR</p>
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
