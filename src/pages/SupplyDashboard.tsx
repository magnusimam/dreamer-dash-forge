import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { useTokenSupply } from "@/hooks/useSupabase";
import { Loader2, Coins, Warehouse, Users, TrendingUp, Clock, BarChart3 } from "lucide-react";

export default function SupplyDashboard() {
  const { data: supply, isLoading } = useTokenSupply();

  if (isLoading || !supply) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pb-20 px-4 pt-6">
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      </motion.div>
    );
  }

  const circulatingPercent = Math.round((supply.total_circulating / supply.total_supply) * 100);
  const treasuryPercent = Math.round((supply.treasury_balance / supply.total_supply) * 100);
  const distributedPercent = Math.round((supply.total_distributed / supply.total_supply) * 100);

  const stats = [
    { label: "Total Supply", value: supply.total_supply.toLocaleString(), sub: "Fixed forever", icon: Coins, color: "text-primary" },
    { label: "Treasury", value: supply.treasury_balance.toLocaleString(), sub: `${treasuryPercent}% of supply`, icon: Warehouse, color: "text-blue-400" },
    { label: "Circulating", value: supply.total_circulating.toLocaleString(), sub: `${circulatingPercent}% of supply`, icon: Users, color: "text-emerald-400" },
    { label: "Total Distributed", value: supply.total_distributed.toLocaleString(), sub: `${distributedPercent}% of supply`, icon: TrendingUp, color: "text-purple-400" },
    { label: "Today's Emission", value: `${supply.today_distributed.toLocaleString()} / ${supply.daily_cap.toLocaleString()}`, sub: "Daily cap", icon: Clock, color: "text-orange-400" },
    { label: "Hackathon Pool", value: supply.hackathon_pool.toLocaleString(), sub: "Prize reserve", icon: BarChart3, color: "text-cyan-400" },
    { label: "Referral Pool", value: supply.referral_pool.toLocaleString(), sub: "Invite rewards", icon: Users, color: "text-pink-400" },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pb-20 px-4 pt-6">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <h1 className="text-2xl font-bold text-foreground mb-2">DR Supply</h1>
        <p className="text-muted-foreground">Live tokenomics dashboard — fully transparent</p>
      </motion.div>

      {/* Supply bar */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mb-6">
        <Card className="gradient-card border-border/50 p-4">
          <p className="text-xs text-muted-foreground mb-2">Supply Distribution</p>
          <div className="w-full h-4 bg-secondary rounded-full overflow-hidden flex">
            <div className="h-full bg-emerald-500 transition-all" style={{ width: `${circulatingPercent}%` }} title="Circulating" />
            <div className="h-full bg-blue-500 transition-all" style={{ width: `${treasuryPercent}%` }} title="Treasury" />
          </div>
          <div className="flex justify-between mt-2 text-xs">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" />Circulating {circulatingPercent}%</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" />Treasury {treasuryPercent}%</span>
          </div>
        </Card>
      </motion.div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + index * 0.05 }}>
              <Card className="gradient-card border-border/50 p-4">
                <Icon className={`w-5 h-5 ${stat.color} mb-2`} />
                <p className="text-lg font-bold text-foreground">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
                <p className="text-[10px] text-muted-foreground/60 mt-0.5">{stat.sub}</p>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Emission info */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="mt-6">
        <Card className="gradient-card border-border/50 p-4">
          <h3 className="font-semibold text-foreground mb-3 text-sm">How DR Works</h3>
          <div className="space-y-2 text-xs text-muted-foreground">
            <p>21,000,000 DR — fixed supply, never increases</p>
            <p>Coins flow: Treasury → Users (earn) → Treasury (spend) → repeat</p>
            <p>2% fee on transfers recycled to treasury</p>
            <p>100% of redemptions recycled — no coins are ever destroyed</p>
            <p>Daily distribution cap halves every year</p>
            <p>Wallet cap: 50,000 DR per user</p>
          </div>
        </Card>
      </motion.div>
    </motion.div>
  );
}
