import { motion } from "framer-motion";
import { Coins, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";

interface BalanceCardProps {
  balance: number;
  dailyEarnings: number;
}

export default function BalanceCard({ balance, dailyEarnings }: BalanceCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
    >
      <Card className="gradient-card shadow-card border-border/50 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 gradient-primary rounded-full flex items-center justify-center shadow-glow">
              <Coins className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Balance</p>
              <h2 className="text-2xl font-bold text-foreground">
                {balance.toLocaleString()} DR
              </h2>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2 text-sm">
          <TrendingUp className="w-4 h-4 text-primary" />
          <span className="text-muted-foreground">Daily earnings:</span>
          <span className="text-primary font-semibold">+{dailyEarnings} DR</span>
        </div>
        
        <div className="mt-4 pt-4 border-t border-border/50">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">USD Value</span>
            <span className="text-foreground font-medium">
              ${(balance * 0.01).toFixed(2)}
            </span>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}