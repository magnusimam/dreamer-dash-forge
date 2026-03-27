import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight, Share2, Copy, Check,
  Flame, Sparkles, TrendingUp, Loader2, MapPin, Shield, BookOpen, Gift, X,
} from "lucide-react";
import BalanceCard from "@/components/BalanceCard";
import TransactionList from "@/components/TransactionList";
import { useTransactions, useTodayCheckin, usePerformCheckin, useStateRankings, useBuyStreakInsurance, useClaimPromoCode } from "@/hooks/useSupabase";
import { useTelegram } from "@/contexts/TelegramContext";
import { useUser } from "@/contexts/UserContext";
import { useToast } from "@/hooks/use-toast";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { hapticNotification } from "@/lib/telegram";
import { notifyDailyCheckin } from "@/lib/notifications";
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
  const claimPromoMutation = useClaimPromoCode();
  const { data: promoClaimCount = 0 } = useQuery({
    queryKey: ["promo_claim_count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("promo_codes")
        .select("*", { count: "exact", head: true })
        .eq("is_used", true);
      if (error) throw error;
      return count ?? 0;
    },
  });
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showPromoModal, setShowPromoModal] = useState(false);
  const [promoCode, setPromoCode] = useState("");
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
      {streak >= 2 && !alreadyCheckedIn && !(dbUser as any)?.streak_protected_until && (
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

      {/* Book Promo Banner */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-4">
        <Card className="border-purple-500/20 bg-gradient-to-r from-purple-500/10 to-primary/10 p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center shrink-0">
              <BookOpen className="w-5 h-5 text-purple-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">The Stolen Breath</p>
              <p className="text-xs text-muted-foreground mb-2">by Abeedah Alabi — Get a copy and earn <span className="text-primary font-semibold">500 DR</span>
                {promoClaimCount > 0 && <span className="text-purple-400"> · {promoClaimCount} claimed</span>}
              </p>
              <div className="flex gap-2">
                <Button size="sm" className="bg-purple-600 hover:bg-purple-700 text-white h-7 text-xs" onClick={() => window.open("https://selar.com/thestolenbreath", "_blank")}>
                  <BookOpen className="w-3 h-3 mr-1" /> Get Book
                </Button>
                <Button size="sm" variant="outline" className="border-primary/30 text-primary h-7 text-xs" onClick={() => setShowPromoModal(true)}>
                  <Gift className="w-3 h-3 mr-1" /> Claim 500 DR
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Promo Code Modal */}
      <AnimatePresence>
        {showPromoModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-end justify-center" onClick={() => setShowPromoModal(false)}>
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 300 }} className="w-full max-w-md bg-card border-t border-border rounded-t-2xl p-6 pb-16" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-foreground text-lg">Claim Promo Code</h3>
                <Button size="icon" variant="ghost" aria-label="Close" onClick={() => setShowPromoModal(false)}><X className="w-4 h-4" /></Button>
              </div>
              <p className="text-sm text-muted-foreground mb-4">Enter the code you received after purchasing <span className="text-foreground font-medium">The Stolen Breath</span></p>
              <Input placeholder="Enter code (e.g. BREATH-A7X2)" value={promoCode} onChange={(e) => setPromoCode(e.target.value.toUpperCase())} className="mb-4 bg-secondary border-border text-center text-lg tracking-widest font-mono" />
              <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-glow" disabled={!promoCode.trim() || claimPromoMutation.isPending}
                onClick={async () => {
                  try {
                    const result = await claimPromoMutation.mutateAsync(promoCode.trim());
                    if (result?.success) {
                      hapticNotification("success");
                      setShowConfetti(true);
                      toast({ title: "Code Claimed!", description: `+${result.reward} DR — ${result.description || "Promo reward"}` });
                      setPromoCode("");
                      setShowPromoModal(false);
                    } else {
                      hapticNotification("error");
                      toast({ title: "Invalid Code", description: result?.error || "Code not recognized", variant: "destructive" });
                    }
                  } catch (err: any) {
                    hapticNotification("error");
                    toast({ title: "Error", description: err?.message || "Failed to claim code. Make sure the code is valid.", variant: "destructive" });
                  }
                }}>
                {claimPromoMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Gift className="w-4 h-4 mr-2" />}
                Claim Reward
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
