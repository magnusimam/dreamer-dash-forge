import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { mockActivities, type Activity } from "@/data/mockData";
import {
  CalendarDays,
  Users,
  KeyRound,
  CheckCircle,
  Coins,
  Sparkles,
  X,
} from "lucide-react";

interface ActivityLogProps {
  onUpdateBalance: (amount: number) => void;
}

const categoryColors: Record<Activity["category"], string> = {
  meeting: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  workshop: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  event: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  outreach: "bg-amber-500/20 text-amber-400 border-amber-500/30",
};

export default function ActivityLog({ onUpdateBalance }: ActivityLogProps) {
  const { toast } = useToast();
  const [activities] = useState(mockActivities);
  const [loggedActivities, setLoggedActivities] = useState<string[]>([]);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [codeInput, setCodeInput] = useState("");
  const [dailyCheckedIn, setDailyCheckedIn] = useState(false);

  const handleDailyCheckIn = () => {
    if (dailyCheckedIn) return;
    setDailyCheckedIn(true);
    onUpdateBalance(25);
    toast({
      title: "Daily Check-in! ☀️",
      description: "+25 DR added to your balance",
    });
  };

  const handleCodeSubmit = () => {
    if (!selectedActivity) return;
    const trimmed = codeInput.trim().toUpperCase();

    if (trimmed === selectedActivity.code) {
      setLoggedActivities((prev) => [...prev, selectedActivity.id]);
      onUpdateBalance(selectedActivity.reward);
      toast({
        title: "Activity Logged! 🎉",
        description: `+${selectedActivity.reward} DR for "${selectedActivity.title}"`,
      });
      setSelectedActivity(null);
      setCodeInput("");
    } else {
      toast({
        title: "Invalid Code",
        description: "Please check your unique code and try again.",
        variant: "destructive",
      });
    }
  };

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
          Activity Log 📋
        </h1>
        <p className="text-muted-foreground">
          Enter your unique code to earn Dreams for activities you attended
        </p>
      </motion.div>

      {/* Daily Check-in */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mb-6"
      >
        <Card className="gradient-card border-border/50 p-4 overflow-hidden relative">
          <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full -translate-y-8 translate-x-8" />
          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Daily Check-in</h3>
                <p className="text-xs text-muted-foreground">+25 DR every day</p>
              </div>
            </div>
            <Button
              size="sm"
              disabled={dailyCheckedIn}
              onClick={handleDailyCheckIn}
              className={
                dailyCheckedIn
                  ? "bg-primary/20 text-primary cursor-default"
                  : "bg-primary hover:bg-primary/90 text-primary-foreground shadow-glow"
              }
            >
              {dailyCheckedIn ? (
                <>
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Claimed
                </>
              ) : (
                "Claim"
              )}
            </Button>
          </div>
        </Card>
      </motion.div>

      {/* Activities */}
      <h2 className="text-lg font-semibold text-foreground mb-3">
        Community Activities
      </h2>

      <div className="space-y-3">
        {activities.map((activity, index) => {
          const isLogged = loggedActivities.includes(activity.id);
          return (
            <motion.div
              key={activity.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + index * 0.08 }}
            >
              <Card className="gradient-card border-border/50 p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 pr-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge
                        variant="outline"
                        className={categoryColors[activity.category]}
                      >
                        {activity.category}
                      </Badge>
                      {isLogged && (
                        <CheckCircle className="w-4 h-4 text-primary" />
                      )}
                    </div>
                    <h3 className="font-semibold text-foreground mb-1">
                      {activity.title}
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {activity.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <CalendarDays className="w-3.5 h-3.5" />
                      {new Date(activity.date).toLocaleDateString("en-NG", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" />
                      {activity.currentParticipants}/{activity.maxParticipants}
                    </span>
                    <span className="flex items-center gap-1">
                      <Coins className="w-3.5 h-3.5 text-primary" />
                      <span className="text-primary font-semibold">
                        +{activity.reward} DR
                      </span>
                    </span>
                  </div>

                  {isLogged ? (
                    <Badge className="bg-primary/20 text-primary border-primary/30">
                      Logged
                    </Badge>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-primary/30 text-primary hover:bg-primary/10"
                      onClick={() => {
                        setSelectedActivity(activity);
                        setCodeInput("");
                      }}
                    >
                      <KeyRound className="w-3 h-3 mr-1" />
                      Enter Code
                    </Button>
                  )}
                </div>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Code Entry Modal */}
      <AnimatePresence>
        {selectedActivity && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end justify-center"
            onClick={() => setSelectedActivity(null)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="w-full max-w-md bg-card border-t border-border rounded-t-2xl p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-foreground text-lg">
                  Log Activity
                </h3>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setSelectedActivity(null)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <p className="text-sm text-muted-foreground mb-1">
                {selectedActivity.title}
              </p>
              <p className="text-primary font-semibold text-sm mb-4">
                +{selectedActivity.reward} DR reward
              </p>

              <label className="text-sm font-medium text-foreground block mb-2">
                Enter your unique attendance code
              </label>
              <Input
                placeholder="e.g. DREAM-Q1-2024"
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value)}
                className="mb-4 bg-secondary border-border"
                onKeyDown={(e) => e.key === "Enter" && handleCodeSubmit()}
              />

              <Button
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-glow"
                onClick={handleCodeSubmit}
                disabled={!codeInput.trim()}
              >
                <KeyRound className="w-4 h-4 mr-2" />
                Submit Code
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
