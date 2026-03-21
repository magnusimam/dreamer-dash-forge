import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  useActivities,
  useUserActivityLogs,
  useLogActivity,
  useTodayCheckin,
  usePerformCheckin,
} from "@/hooks/useSupabase";
import {
  CalendarDays,
  KeyRound,
  CheckCircle,
  Coins,
  Sparkles,
  X,
  Loader2,
} from "lucide-react";
import { hapticNotification } from "@/lib/telegram";
import { cn } from "@/lib/utils";

const categoryColors: Record<string, string> = {
  meeting: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  workshop: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  event: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  outreach: "bg-amber-500/20 text-amber-400 border-amber-500/30",
};

export default function ActivityLog() {
  const { toast } = useToast();
  const { data: activities = [], isLoading: activitiesLoading } = useActivities();
  const { data: loggedActivityIds = [] } = useUserActivityLogs();
  const { data: alreadyCheckedIn = false } = useTodayCheckin();
  const logActivityMutation = useLogActivity();
  const checkinMutation = usePerformCheckin();

  const [selectedActivity, setSelectedActivity] = useState<any | null>(null);
  const [codeInput, setCodeInput] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const handleDailyCheckIn = async () => {
    if (alreadyCheckedIn) return;
    try {
      const result = await checkinMutation.mutateAsync();
      if (result?.success) {
        hapticNotification("success");
        toast({
          title: "Daily Check-in! ☀️",
          description: `+${result.reward} DR added. Streak: ${result.streak} days!`,
        });
      } else {
        toast({
          title: "Check-in failed",
          description: result?.error || "Please try again.",
          variant: "destructive",
        });
      }
    } catch {
      hapticNotification("error");
      toast({ title: "Error", description: "Check-in failed.", variant: "destructive" });
    }
  };

  const handleCodeSubmit = async () => {
    if (!selectedActivity) return;
    const trimmed = codeInput.trim().toUpperCase();

    try {
      const result = await logActivityMutation.mutateAsync(trimmed);
      if (result?.success) {
        hapticNotification("success");
        toast({
          title: "Activity Logged! 🎉",
          description: `+${result.reward} DR for "${result.activity}"`,
        });
        setSelectedActivity(null);
        setCodeInput("");
      } else {
        hapticNotification("error");
        toast({
          title: "Failed",
          description: result?.error || "Invalid code.",
          variant: "destructive",
        });
      }
    } catch {
      hapticNotification("error");
      toast({ title: "Error", description: "Please try again.", variant: "destructive" });
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
              disabled={alreadyCheckedIn || checkinMutation.isPending}
              onClick={handleDailyCheckIn}
              className={
                alreadyCheckedIn
                  ? "bg-primary/20 text-primary cursor-default"
                  : "bg-primary hover:bg-primary/90 text-primary-foreground shadow-glow"
              }
            >
              {checkinMutation.isPending ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : alreadyCheckedIn ? (
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

      {/* Category filter chips */}
      <div className="mb-4 overflow-x-auto scrollbar-hide">
        <div className="flex gap-2 pb-2">
          {["all", "meeting", "workshop", "event", "outreach"].map((cat) => (
            <Button
              key={cat}
              size="sm"
              variant={categoryFilter === cat ? "default" : "outline"}
              className={cn(
                "whitespace-nowrap text-xs h-8 capitalize",
                categoryFilter === cat
                  ? "bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setCategoryFilter(cat)}
            >
              {cat === "all" ? "All" : cat}
            </Button>
          ))}
        </div>
      </div>

      {activitiesLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : activities.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          No activities available right now.
        </p>
      ) : (
        <div className="space-y-3">
          {activities
            .filter((activity: any) => categoryFilter === "all" || activity.category === categoryFilter)
            .map((activity: any, index: number) => {
            const isLogged = loggedActivityIds.includes(activity.id);
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
                          className={categoryColors[activity.category] || ""}
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
                      {activity.description && (
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {activity.description}
                        </p>
                      )}
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
      )}

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
                disabled={!codeInput.trim() || logActivityMutation.isPending}
              >
                {logActivityMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <KeyRound className="w-4 h-4 mr-2" />
                )}
                Submit Code
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
