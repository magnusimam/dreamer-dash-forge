import { motion } from "framer-motion";
import { TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import logoImg from "@/assets/dreamers-coin-logo.png";

// Based on redemption rates: 599 DR = ₦200 → 1 DR ≈ ₦0.33
const DR_TO_NGN = 0.33;
const NGN_TO_USD = 1 / 1600; // approximate exchange rate

interface BalanceCardProps {
  balance: number;
  dailyEarnings: number;
}

export default function BalanceCard({ balance, dailyEarnings }: BalanceCardProps) {
  const ngnValue = balance * DR_TO_NGN;
  const usdValue = ngnValue * NGN_TO_USD;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
    >
      <Card className="gradient-card shadow-card border-border/50 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <img src={logoImg} alt="DR" className="w-12 h-12 rounded-full shadow-glow object-cover" />
            <div>
              <p className="text-sm text-muted-foreground">Total Balance</p>
              <h2 className="text-2xl font-bold text-foreground">
                {balance.toLocaleString()} DR
              </h2>
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2 text-sm">
            <TrendingUp className="w-4 h-4 text-primary" />
            <span className="text-muted-foreground">Daily earnings:</span>
            <span className="text-primary font-semibold">+{dailyEarnings} DR</span>
          </div>
          <p className="text-xs text-muted-foreground/60 mt-1">Estimated from your current streak</p>
        </div>

        <div className="mt-4 pt-4 border-t border-border/50">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-muted-foreground">Redemption Value</span>
            <span className="text-foreground font-medium">
              {ngnValue.toLocaleString()} NGN
            </span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground/60">Approx. USD</span>
            <span className="text-muted-foreground">
              ~${usdValue.toFixed(2)}
            </span>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}