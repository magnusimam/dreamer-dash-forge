import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowRight, Zap, Share2, Copy, Check, BarChart3 } from "lucide-react";
import BalanceCard from "@/components/BalanceCard";
import TransactionList from "@/components/TransactionList";
import { useTransactions } from "@/hooks/useSupabase";
import { useTelegram } from "@/contexts/TelegramContext";
import { useUser } from "@/contexts/UserContext";
import { useToast } from "@/hooks/use-toast";

interface HomeProps {
  onTabChange: (tab: string) => void;
}

const BOT_USERNAME = "DreamersDashBot";

export default function Home({ onTabChange }: HomeProps) {
  const { user } = useTelegram();
  const { dbUser } = useUser();
  const { data: recentTransactions = [] } = useTransactions(3);
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const balance = dbUser?.balance ?? 0;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="pb-20 px-4 pt-6"
    >
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <h1 className="text-2xl font-bold text-foreground mb-2">
          Welcome Back, {user?.firstName ?? "Dreamer"}! 👋
        </h1>
        <p className="text-muted-foreground">
          Keep earning Dreamers Coins and unlock amazing rewards
        </p>
      </motion.div>

      {/* Balance Card */}
      <BalanceCard balance={balance} dailyEarnings={dbUser?.streak ? dbUser.streak * 25 : 0} />

      {/* Supply link */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }} className="mb-4 -mt-4">
        <Button variant="ghost" size="sm" className="text-xs text-muted-foreground w-full" onClick={() => onTabChange("supply")}>
          <BarChart3 className="w-3 h-3 mr-1" /> View DR Supply Dashboard
        </Button>
      </motion.div>

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="grid grid-cols-2 gap-3 mb-6"
      >
        <Button
          onClick={() => onTabChange("activities")}
          className="h-14 gradient-primary text-primary-foreground shadow-glow hover:shadow-none transition-smooth"
        >
          <Zap className="w-5 h-5 mr-2" />
          Earn More
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
                <p className="text-xs text-muted-foreground">Share your code and earn bonus DR</p>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-secondary rounded-lg p-3 mb-3">
              <code className="text-sm font-mono text-foreground flex-1">{dbUser.referral_code}</code>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 px-2"
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
    </motion.div>
  );
}
