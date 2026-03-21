import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Clock, Coins, Loader2, RefreshCw, Timer } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

interface Mission {
  id: string;
  title: string;
  description?: string;
  reward: number;
  completed: boolean;
  category: string;
  is_daily?: boolean;
  expires_at?: string | null;
}

interface MissionCardProps {
  mission: Mission;
  onComplete: (missionId: string) => Promise<void>;
}

export default function MissionCard({ mission, onComplete }: MissionCardProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleComplete = async () => {
    if (mission.completed || loading) return;

    setLoading(true);
    try {
      await onComplete(mission.id);
      toast({
        title: "Mission Completed!",
        description: `+${mission.reward} DR added to your balance`,
      });
    } catch {
      toast({ title: "Error", description: "Failed to complete mission.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.02 }}
      transition={{ duration: 0.2 }}
    >
      <Card className="gradient-card border-border/50 p-4 mb-3">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <Badge variant="secondary" className="text-xs">
                {mission.category}
              </Badge>
              {mission.is_daily && (
                <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-400 border-blue-500/30">
                  <RefreshCw className="w-2.5 h-2.5 mr-1" />Daily
                </Badge>
              )}
              {mission.expires_at && new Date(mission.expires_at) > new Date() && (
                <Badge variant="outline" className="text-xs bg-orange-500/10 text-orange-400 border-orange-500/30">
                  <Timer className="w-2.5 h-2.5 mr-1" />Limited
                </Badge>
              )}
              {mission.completed && (
                <CheckCircle className="w-4 h-4 text-primary" />
              )}
            </div>
            <h3 className="font-semibold text-foreground mb-1">
              {mission.title}
            </h3>
            {mission.description && (
              <p className="text-sm text-muted-foreground">
                {mission.description}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Coins className="w-4 h-4 text-primary" />
            <span className="text-primary font-semibold">
              +{mission.reward} DR
            </span>
          </div>

          {mission.completed ? (
            <Badge className="bg-primary/20 text-primary border-primary/30">
              <CheckCircle className="w-3 h-3 mr-1" />
              Completed
            </Badge>
          ) : (
            <Button
              size="sm"
              onClick={handleComplete}
              disabled={loading}
              className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-glow"
            >
              {loading ? (
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              ) : (
                <Clock className="w-3 h-3 mr-1" />
              )}
              Complete
            </Button>
          )}
        </div>
      </Card>
    </motion.div>
  );
}
