import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Clock, Coins } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Mission {
  id: string;
  title: string;
  description: string;
  reward: number;
  completed: boolean;
  category: string;
}

interface MissionCardProps {
  mission: Mission;
  onComplete: (missionId: string) => void;
}

export default function MissionCard({ mission, onComplete }: MissionCardProps) {
  const { toast } = useToast();

  const handleComplete = () => {
    if (mission.completed) return;
    
    onComplete(mission.id);
    toast({
      title: "Mission Completed!",
      description: `+${mission.reward} DR added to your balance`,
    });
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
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="secondary" className="text-xs">
                {mission.category}
              </Badge>
              {mission.completed && (
                <CheckCircle className="w-4 h-4 text-primary" />
              )}
            </div>
            <h3 className="font-semibold text-foreground mb-1">
              {mission.title}
            </h3>
            <p className="text-sm text-muted-foreground">
              {mission.description}
            </p>
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
              className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-glow"
            >
              <Clock className="w-3 h-3 mr-1" />
              Complete
            </Button>
          )}
        </div>
      </Card>
    </motion.div>
  );
}