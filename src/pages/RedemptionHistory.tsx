import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useUserRedemptions } from "@/hooks/useSupabase";
import { Loader2, Clock, CheckCircle, XCircle, Gift } from "lucide-react";

const statusConfig: Record<string, { color: string; icon: any; label: string }> = {
  pending: { color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30", icon: Clock, label: "Pending" },
  approved: { color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", icon: CheckCircle, label: "Approved" },
  rejected: { color: "bg-red-500/20 text-red-400 border-red-500/30", icon: XCircle, label: "Rejected" },
  fulfilled: { color: "bg-blue-500/20 text-blue-400 border-blue-500/30", icon: Gift, label: "Fulfilled" },
};

export default function RedemptionHistory() {
  const { data: redemptions = [], isLoading } = useUserRedemptions();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="pb-20 px-4 pt-6"
    >
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <h1 className="text-2xl font-bold text-foreground mb-2">My Redemptions</h1>
        <p className="text-muted-foreground">Track the status of your redemption requests</p>
      </motion.div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : redemptions.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          No redemption requests yet. Go to Redeem to get started!
        </p>
      ) : (
        <div className="space-y-3">
          {redemptions.map((req: any, index: number) => {
            const config = statusConfig[req.status] || statusConfig.pending;
            const StatusIcon = config.icon;
            return (
              <motion.div
                key={req.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className="gradient-card border-border/50 p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <Badge variant="outline" className={config.color}>
                        <StatusIcon className="w-3 h-3 mr-1" />
                        {config.label}
                      </Badge>
                      <p className="font-medium text-foreground text-sm mt-2 capitalize">{req.category}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-primary font-bold">{req.amount} DR</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(req.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  {req.details && Object.keys(req.details).length > 0 && (
                    <div className="bg-secondary rounded-lg p-2 mb-2">
                      {Object.entries(req.details).map(([key, value]) => (
                        <div key={key} className="flex justify-between text-xs mb-0.5 last:mb-0">
                          <span className="text-muted-foreground capitalize">{key.replace(/([A-Z])/g, " $1")}</span>
                          <span className="text-foreground">{String(value)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {req.admin_notes && (
                    <p className="text-xs text-muted-foreground italic">Admin: {req.admin_notes}</p>
                  )}

                  {req.status !== "pending" && req.updated_at && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Updated: {new Date(req.updated_at).toLocaleDateString()}
                    </p>
                  )}
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
