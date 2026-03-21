import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Confetti } from "@/components/Confetti";
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
  Camera,
} from "lucide-react";
import { hapticNotification } from "@/lib/telegram";
import { cn } from "@/lib/utils";
import { uploadImage } from "@/lib/storage";
import { useUser } from "@/contexts/UserContext";
import { notifyDailyCheckin } from "@/lib/notifications";
import { SkeletonList } from "@/components/SkeletonCard";

const categoryColors: Record<string, string> = {
  meeting: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  workshop: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  event: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  outreach: "bg-amber-500/20 text-amber-400 border-amber-500/30",
};

export default function ActivityLog() {
  const { toast } = useToast();
  const { dbUser } = useUser();
  const { data: activities = [], isLoading: activitiesLoading } = useActivities();
  const { data: loggedActivityIds = [] } = useUserActivityLogs();
  const { data: alreadyCheckedIn = false } = useTodayCheckin();
  const logActivityMutation = useLogActivity();
  const checkinMutation = usePerformCheckin();

  const [selectedActivity, setSelectedActivity] = useState<any | null>(null);
  const [codeInput, setCodeInput] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [codeSubmitted, setCodeSubmitted] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  const handleDailyCheckIn = async () => {
    if (alreadyCheckedIn) return;
    try {
      const result = await checkinMutation.mutateAsync();
      if (result?.success) {
        hapticNotification("success");
        setShowConfetti(true);
        toast({
          title: "Daily Check-in! ☀️",
          description: `+${result.reward} DR added. Streak: ${result.streak} days!`,
        });
        if (dbUser?.telegram_id) notifyDailyCheckin(dbUser.telegram_id, result.reward, result.streak);
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

  const handleSubmit = async () => {
    if (!selectedActivity) return;
    setCodeSubmitted(true);
    const trimmed = codeInput.trim().toUpperCase();

    if (selectedActivity.code_required !== false && !trimmed) return;

    if (selectedActivity.proof_required && !proofFile) {
      toast({ title: "Proof required", description: "Please upload a screenshot or photo.", variant: "destructive" });
      return;
    }

    let proofUrl: string | undefined;
    if (proofFile && dbUser) {
      setUploading(true);
      try {
        proofUrl = await uploadImage("activity-proofs", proofFile, dbUser.id);
      } catch {
        toast({ title: "Upload failed", variant: "destructive" });
        setUploading(false);
        return;
      }
    }

    try {
      const result = await logActivityMutation.mutateAsync({ code: trimmed, proofUrl });
      if (result?.success) {
        hapticNotification("success");
        if (result?.pending_approval) {
          toast({
            title: "Proof submitted!",
            description: "Reward after admin approval.",
          });
        } else {
          toast({
            title: "Activity Logged! 🎉",
            description: `+${result.reward} DR for "${result.activity}"`,
          });
        }
        setSelectedActivity(null);
        setCodeInput("");
        setProofFile(null);
        setCodeSubmitted(false);
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
    } finally {
      setUploading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="pb-28 px-4 pt-6"
    >
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <h1 className="text-2xl font-bold text-foreground mb-2">
          Activity Log
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
        <SkeletonList count={4} />
      ) : activities.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          No activities yet. Complete your daily check-in above to start earning!
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
                          setProofFile(null);
                          setCodeSubmitted(false);
                        }}
                      >
                        {activity.proof_required && !activity.code_required ? (
                          <>
                            <Camera className="w-3 h-3 mr-1" />
                            Upload Proof
                          </>
                        ) : activity.code_required && activity.proof_required ? (
                          <>
                            <KeyRound className="w-3 h-3 mr-1" />
                            Code + Proof
                          </>
                        ) : (
                          <>
                            <KeyRound className="w-3 h-3 mr-1" />
                            Enter Code
                          </>
                        )}
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
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-end justify-center"
            onClick={() => setSelectedActivity(null)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="w-full max-w-md bg-card border-t border-border rounded-t-2xl p-6 pb-16"
              onClick={(e) => e.stopPropagation()}
              drag="y"
              dragConstraints={{ top: 0 }}
              dragElastic={0.2}
              onDragEnd={(_, info) => {
                if (info.offset.y > 100) {
                  setSelectedActivity(null);
                }
              }}
            >
              <div className="w-10 h-1 bg-border rounded-full mx-auto mb-4" />
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-foreground text-lg">
                  Log Activity
                </h3>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Close"
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

              {selectedActivity.code_required !== false && (
                <>
                  <label className="text-sm font-medium text-foreground block mb-2">
                    Enter your unique attendance code
                  </label>
                  <Input
                    placeholder="e.g. DREAM-Q1-2024"
                    value={codeInput}
                    onChange={(e) => {
                      setCodeInput(e.target.value);
                      if (codeSubmitted) setCodeSubmitted(false);
                    }}
                    className={cn("bg-secondary border-border", codeSubmitted && !codeInput.trim() ? "mb-1" : "mb-4")}
                    onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                  />
                  {codeSubmitted && !codeInput.trim() && (
                    <p className="text-xs text-destructive mt-1 mb-4">Please enter your attendance code</p>
                  )}
                </>
              )}

              {selectedActivity.proof_required && (
                <div>
                  <label className="text-sm font-medium text-foreground block mb-2">
                    Upload proof (screenshot/photo)
                  </label>
                  {proofFile ? (
                    <div className="relative mb-4">
                      <img src={URL.createObjectURL(proofFile)} alt="Proof" className="w-full h-40 object-cover rounded-lg border border-border" />
                      <Button size="icon" variant="ghost" className="absolute top-2 right-2 bg-black/50 h-7 w-7" aria-label="Remove image" onClick={() => setProofFile(null)}>
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50">
                        <Camera className="w-8 h-8 text-muted-foreground mb-2" />
                        <span className="text-sm text-muted-foreground">Tap to upload</span>
                        <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          if (file.size > 5 * 1024 * 1024) {
                            toast({ title: "File too large", description: "Maximum file size is 5MB", variant: "destructive" });
                            return;
                          }
                          if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
                            toast({ title: "Invalid format", description: "Please upload JPG, PNG, or WebP images", variant: "destructive" });
                            return;
                          }
                          setProofFile(file);
                        }} />
                      </label>
                      <p className="text-xs text-muted-foreground mt-1 mb-4">JPG, PNG or WebP. Max 5MB.</p>
                    </>
                  )}
                </div>
              )}

              <Button
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-glow"
                onClick={handleSubmit}
                disabled={
                  (selectedActivity.proof_required && !proofFile) ||
                  logActivityMutation.isPending ||
                  uploading
                }
              >
                {uploading || logActivityMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : selectedActivity.proof_required && selectedActivity.code_required !== false ? (
                  <KeyRound className="w-4 h-4 mr-2" />
                ) : selectedActivity.proof_required ? (
                  <Camera className="w-4 h-4 mr-2" />
                ) : (
                  <KeyRound className="w-4 h-4 mr-2" />
                )}
                {uploading
                  ? "Uploading..."
                  : selectedActivity.proof_required && selectedActivity.code_required !== false
                  ? "Submit"
                  : selectedActivity.proof_required
                  ? "Submit Proof"
                  : "Submit Code"}
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <Confetti active={showConfetti} onComplete={() => setShowConfetti(false)} />
    </motion.div>
  );
}
