import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight, Zap } from "lucide-react";
import BalanceCard from "@/components/BalanceCard";
import TransactionList from "@/components/TransactionList";
import { mockTransactions } from "@/data/mockData";

interface HomeProps {
  balance: number;
  onTabChange: (tab: string) => void;
}

export default function Home({ balance, onTabChange }: HomeProps) {
  const dailyEarnings = 150;
  const recentTransactions = mockTransactions.slice(0, 3);

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
          Welcome Back! 👋
        </h1>
        <p className="text-muted-foreground">
          Keep earning Dreamers Coins and unlock amazing rewards
        </p>
      </motion.div>

      {/* Balance Card */}
      <BalanceCard balance={balance} dailyEarnings={dailyEarnings} />

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="grid grid-cols-2 gap-3 mb-6"
      >
        <Button
          onClick={() => onTabChange("missions")}
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
        
        <TransactionList transactions={recentTransactions} />
      </motion.div>
    </motion.div>
  );
}