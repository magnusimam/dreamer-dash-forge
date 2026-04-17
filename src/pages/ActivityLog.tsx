import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Confetti } from "@/components/Confetti";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import {
  useActivities,
  useUserActivityLogs,
  useLogActivity,
  useTodayCheckin,
  usePerformCheckin,
  useMissions,
  useUserMissionCompletions,
  useUserMissionUnlocks,
  useUnlockMission,
  useSubmitMissionProof,
  useCompleteMission,
  useClaimPromoCode,
  useMagicBoxes,
  useUserBoxEntries,
} from "@/hooks/useSupabase";
import MagicBoxComponent from "@/components/MagicBox";
import {
  CalendarDays,
  KeyRound,
  CheckCircle,
  Coins,
  Sparkles,
  X,
  Loader2,
  Camera,
  Lock,
  Unlock,
  Target,
  BookOpen,
  Gift,
} from "lucide-react";
import { hapticNotification } from "@/lib/telegram";
import { cn } from "@/lib/utils";
import { uploadImage } from "@/lib/storage";
import { useUser } from "@/contexts/UserContext";
import { notifyDailyCheckin, notifyUser } from "@/lib/notifications";
import { supabase } from "@/lib/supabase";
import { Search, User } from "lucide-react";
import { SkeletonList } from "@/components/SkeletonCard";

const categoryColors: Record<string, string> = {
  meeting: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  workshop: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  event: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  outreach: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  promo: "bg-pink-500/20 text-pink-400 border-pink-500/30",
  task: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
};

export default function ActivityLog() {
  const { toast } = useToast();
  const { dbUser } = useUser();
  const { data: activities = [], isLoading: activitiesLoading } = useActivities();
  const { data: loggedActivityIds = [] } = useUserActivityLogs();
  const { data: alreadyCheckedIn = false } = useTodayCheckin();
  const logActivityMutation = useLogActivity();
  const checkinMutation = usePerformCheckin();
  const { data: missions = [] } = useMissions();
  const { data: missionCompletionData = { ids: [], statuses: {} } } = useUserMissionCompletions();
  const completedMissionIds = missionCompletionData.ids;
  const missionStatuses = missionCompletionData.statuses;
  const { data: unlockedMissionIds = [] } = useUserMissionUnlocks();
  const unlockMissionMutation = useUnlockMission();
  const completeMissionMutation = useCompleteMission();
  const submitMissionProofMutation = useSubmitMissionProof();
  const claimPromoMutation = useClaimPromoCode();
  const { data: magicBoxes = [] } = useMagicBoxes();
  const { data: myBoxEntries = {} } = useUserBoxEntries();
  const [showPromoModal, setShowPromoModal] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const { data: promoClaimCount = 0 } = useQuery({
    queryKey: ["promo_claim_count"],
    queryFn: async () => {
      const { count } = await supabase.from("promo_codes").select("*", { count: "exact", head: true }).eq("is_used", true);
      return count ?? 0;
    },
  });

  const [selectedActivity, setSelectedActivity] = useState<any | null>(null);
  const [codeInput, setCodeInput] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [codeSubmitted, setCodeSubmitted] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [selectedMission, setSelectedMission] = useState<any | null>(null);
  const [missionCodeInput, setMissionCodeInput] = useState("");
  const [missionProofFile, setMissionProofFile] = useState<File | null>(null);
  const [missionUploading, setMissionUploading] = useState(false);
  const [giftSearchInput, setGiftSearchInput] = useState("");
  const [giftSuggestions, setGiftSuggestions] = useState<any[]>([]);
  const [selectedGiftUser, setSelectedGiftUser] = useState<any | null>(null);
  const [showGiftDropdown, setShowGiftDropdown] = useState(false);
  const giftDropdownRef = useRef<HTMLDivElement>(null);

  // Close gift dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (giftDropdownRef.current && !giftDropdownRef.current.contains(e.target as Node)) {
        setShowGiftDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Debounced gift user search
  useEffect(() => {
    if (selectedGiftUser) return;
    const trimmed = giftSearchInput.trim().replace(/^@/, "");
    if (trimmed.length < 2) { setGiftSuggestions([]); setShowGiftDropdown(false); return; }
    const timer = setTimeout(async () => {
      const escaped = trimmed.replace(/%/g, "\\%").replace(/_/g, "\\_");
      const { data } = await supabase
        .from("users")
        .select("id, first_name, last_name, username, telegram_id")
        .or(`username.ilike.%${escaped}%,first_name.ilike.%${escaped}%`)
        .neq("id", dbUser?.id || "")
        .limit(8);
      setGiftSuggestions(data || []);
      setShowGiftDropdown(true);
    }, 300);
    return () => clearTimeout(timer);
  }, [giftSearchInput, selectedGiftUser, dbUser?.id]);

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
    // For proof-only activities (no code required), use the activity's own code
    const codeToSend = selectedActivity.code_required === false ? selectedActivity.code : trimmed;

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
      const result = await logActivityMutation.mutateAsync({ code: codeToSend, proofUrl });
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

      {/* Monthly Missions */}
      {missions.filter((m: any) => m.unlock_fee > 0).length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" /> Monthly Missions
          </h2>
          <div className="space-y-3">
            {missions.filter((m: any) => m.unlock_fee > 0).map((mission: any) => {
              const isUnlocked = unlockedMissionIds.includes(mission.id);
              const isSubmitted = completedMissionIds.includes(mission.id);
              const missionStatus = missionStatuses[mission.id];
              const isApproved = missionStatus === "approved";
              const isPending = missionStatus === "pending";
              const isCompleted = isApproved;
              const isExpired = mission.expires_at && new Date(mission.expires_at) < new Date();

              return (
                <Card key={mission.id} className={`gradient-card border-border/50 p-4 ${isExpired && !isCompleted ? "opacity-50" : ""}`}>
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-foreground text-sm">
                          {isUnlocked || isCompleted ? mission.title : "🔒 Mystery Mission"}
                        </h3>
                        {isCompleted && <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]">Completed</Badge>}
                        {isExpired && !isCompleted && <Badge className="bg-muted text-muted-foreground text-[10px]">Ended</Badge>}
                      </div>
                      {isUnlocked || isCompleted ? (
                        <p className="text-xs text-muted-foreground mt-1">{mission.description}</p>
                      ) : (
                        <p className="text-xs text-muted-foreground mt-1 italic">Pay to unlock and reveal this mission</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                    <span className="flex items-center gap-1"><Lock className="w-3 h-3" />{mission.unlock_fee} DR to unlock</span>
                    <span className="flex items-center gap-1"><Coins className="w-3 h-3 text-primary" />+{mission.reward} DR reward</span>
                    {mission.expires_at && (
                      <span className="flex items-center gap-1"><CalendarDays className="w-3 h-3" />{new Date(mission.expires_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
                    )}
                  </div>

                  {isApproved ? (
                    <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
                      <CheckCircle className="w-4 h-4 text-emerald-400" />
                      <span className="text-sm text-emerald-400 font-medium">Mission Complete — +{mission.reward} DR</span>
                    </div>
                  ) : isPending ? (
                    <div className="flex items-center gap-2 bg-orange-500/10 border border-orange-500/20 rounded-lg px-3 py-2">
                      <Loader2 className="w-4 h-4 text-orange-400" />
                      <span className="text-sm text-orange-400 font-medium">Proof submitted — Awaiting review</span>
                    </div>
                  ) : isUnlocked ? (
                    <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => { setSelectedMission(mission); setMissionProofFile(null); }}>
                      <Camera className="w-4 h-4 mr-2" /> Upload Proof & Submit
                    </Button>
                  ) : isExpired ? (
                    <div className="flex items-center gap-2 bg-muted/50 border border-border rounded-lg px-3 py-2">
                      <span className="text-sm text-muted-foreground font-medium">This mission has ended</span>
                    </div>
                  ) : (
                    <Button
                      className="w-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-glow"
                      disabled={unlockMissionMutation.isPending || (dbUser?.balance ?? 0) < mission.unlock_fee}
                      onClick={async () => {
                        try {
                          const result = await unlockMissionMutation.mutateAsync(mission.id);
                          if (result?.success) {
                            hapticNotification("success");
                            toast({ title: "Mission Unlocked!", description: `${result.mission} — ${result.description || "Check the details"}` });
                          } else {
                            hapticNotification("error");
                            toast({ title: "Failed", description: result?.error, variant: "destructive" });
                          }
                        } catch (err: any) {
                          hapticNotification("error");
                          toast({ title: "Error", description: err?.message || "Failed to unlock", variant: "destructive" });
                        }
                      }}
                    >
                      {unlockMissionMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Unlock className="w-4 h-4 mr-2" />}
                      Unlock for {mission.unlock_fee} DR
                    </Button>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Mission Proof Upload Modal */}
      <AnimatePresence>
        {selectedMission && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-end justify-center" onClick={() => setSelectedMission(null)}>
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 300 }} className="w-full max-w-md bg-card border-t border-border rounded-t-2xl p-6 pb-16" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-foreground text-lg">Submit Proof</h3>
                <Button size="icon" variant="ghost" aria-label="Close" onClick={() => setSelectedMission(null)}><X className="w-4 h-4" /></Button>
              </div>
              <p className="text-sm font-medium text-foreground mb-1">{selectedMission.title}</p>
              <p className="text-xs text-muted-foreground mb-4">{selectedMission.description}</p>

              <p className="text-xs text-muted-foreground mb-2">Upload proof (screenshot, photo, receipt)</p>
              <label className="flex items-center justify-center gap-2 w-full h-20 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 mb-3">
                {missionProofFile ? (
                  <span className="text-sm text-primary font-medium">{missionProofFile.name}</span>
                ) : (
                  <>
                    <Camera className="w-5 h-5 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Tap to select image</span>
                  </>
                )}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => setMissionProofFile(e.target.files?.[0] || null)} />
              </label>

              {/* Gift recipient search */}
              <div ref={giftDropdownRef} className="relative mb-4">
                <p className="text-xs text-muted-foreground mb-1">Who did you gift?</p>
                {selectedGiftUser ? (
                  <div className="flex items-center gap-2 bg-secondary border border-emerald-500/30 rounded-md px-3 py-2">
                    <div className="w-7 h-7 rounded-full bg-emerald-500/20 flex items-center justify-center">
                      <User className="w-3.5 h-3.5 text-emerald-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {selectedGiftUser.first_name}{selectedGiftUser.last_name ? ` ${selectedGiftUser.last_name}` : ""}
                      </p>
                      {selectedGiftUser.username && <p className="text-[10px] text-muted-foreground">@{selectedGiftUser.username}</p>}
                    </div>
                    <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={() => { setSelectedGiftUser(null); setGiftSearchInput(""); }}>
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                      <Input placeholder="Search by name or username..." value={giftSearchInput} onChange={(e) => setGiftSearchInput(e.target.value)} onFocus={() => { if (giftSuggestions.length > 0) setShowGiftDropdown(true); }} className="pl-9 bg-secondary border-border text-sm" />
                    </div>
                    {showGiftDropdown && giftSuggestions.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-lg shadow-lg overflow-hidden max-h-40 overflow-y-auto">
                        {giftSuggestions.map((u: any) => (
                          <button key={u.id} type="button" className="w-full flex items-center gap-2 px-3 py-2 hover:bg-secondary/80 text-left" onClick={() => { setSelectedGiftUser(u); setGiftSearchInput(""); setShowGiftDropdown(false); }}>
                            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                              <User className="w-3.5 h-3.5 text-primary" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-foreground truncate">{u.first_name}{u.last_name ? ` ${u.last_name}` : ""}</p>
                              <p className="text-[10px] text-muted-foreground">{u.username ? `@${u.username}` : "No username"}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white" disabled={!missionProofFile || !selectedGiftUser || submitMissionProofMutation.isPending || missionUploading}
                onClick={async () => {
                  if (!missionProofFile || !dbUser) return;
                  if (missionProofFile.size > 5 * 1024 * 1024) {
                    toast({ title: "File too large", description: "Max 5MB. Try a smaller image.", variant: "destructive" });
                    return;
                  }
                  setMissionUploading(true);
                  try {
                    const proofUrl = await uploadImage("mission-proofs", missionProofFile, dbUser.id);
                    const result = await submitMissionProofMutation.mutateAsync({ missionId: selectedMission.id, proofUrl });
                    if (result?.success) {
                      hapticNotification("success");
                      toast({ title: "Proof Submitted!", description: "Admin will review and approve your mission." });
                      if (selectedGiftUser?.telegram_id) {
                        const senderName = [dbUser.first_name, dbUser.last_name].filter(Boolean).join(" ");
                        notifyUser(selectedGiftUser.telegram_id, `🎁 <b>You've been gifted!</b>\n\n<b>${senderName}</b> just gifted you ₦1,000 as part of the Dreamers Mission!\n\nOpen the app to say thank you! 🎉`);
                      }
                      setSelectedMission(null);
                      setMissionProofFile(null);
                      setSelectedGiftUser(null);
                      setGiftSearchInput("");
                    } else {
                      hapticNotification("error");
                      toast({ title: "Failed", description: result?.error, variant: "destructive" });
                    }
                  } catch (err: any) {
                    hapticNotification("error");
                    toast({ title: "Error", description: err?.message || "Failed to submit", variant: "destructive" });
                  } finally {
                    setMissionUploading(false);
                  }
                }}>
                {missionUploading || submitMissionProofMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Camera className="w-4 h-4 mr-2" />}
                Submit for Review
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Promo Section */}
      {(categoryFilter === "all" || categoryFilter === "promo") && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-pink-400" /> Promos
          </h2>
          <Card className="gradient-card border-pink-500/20 p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-pink-500/20 flex items-center justify-center shrink-0">
                <BookOpen className="w-5 h-5 text-pink-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">The Stolen Breath</p>
                <p className="text-xs text-muted-foreground mb-2">by Abeedah Alabi — Get a copy and earn <span className="text-primary font-semibold">500 DR</span>
                  {promoClaimCount > 0 && <span className="text-pink-400"> · {promoClaimCount} claimed</span>}
                </p>
                <div className="flex gap-2">
                  <Button size="sm" className="bg-pink-600 hover:bg-pink-700 text-white h-7 text-xs" onClick={() => window.open("https://selar.com/thestolenbreath", "_blank")}>
                    <BookOpen className="w-3 h-3 mr-1" /> Get Book
                  </Button>
                  <Button size="sm" variant="outline" className="border-primary/30 text-primary h-7 text-xs" onClick={() => setShowPromoModal(true)}>
                    <Gift className="w-3 h-3 mr-1" /> Claim 500 DR
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Promo Claim Modal */}
      <AnimatePresence>
        {showPromoModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-end justify-center" onClick={() => setShowPromoModal(false)}>
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 300 }} className="w-full max-w-md bg-card border-t border-border rounded-t-2xl p-6 pb-16" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-foreground text-lg">Claim Promo Code</h3>
                <Button size="icon" variant="ghost" aria-label="Close" onClick={() => setShowPromoModal(false)}><X className="w-4 h-4" /></Button>
              </div>
              <p className="text-sm text-muted-foreground mb-4">Enter the code you received after purchasing <span className="text-foreground font-medium">The Stolen Breath</span></p>
              <Input placeholder="Enter code (e.g. BREATH-A7X2)" value={promoCode} onChange={(e) => setPromoCode(e.target.value.toUpperCase())} className="mb-4 bg-secondary border-border text-center text-lg tracking-widest font-mono" />
              <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-glow" disabled={!promoCode.trim() || claimPromoMutation.isPending}
                onClick={async () => {
                  try {
                    const result = await claimPromoMutation.mutateAsync(promoCode.trim());
                    if (result?.success) {
                      hapticNotification("success");
                      setShowConfetti(true);
                      toast({ title: "Code Claimed!", description: `+${result.reward} DR — ${result.description || "Promo reward"}` });
                      setPromoCode("");
                      setShowPromoModal(false);
                    } else {
                      hapticNotification("error");
                      toast({ title: "Invalid Code", description: result?.error || "Code not recognized", variant: "destructive" });
                    }
                  } catch (err: any) {
                    hapticNotification("error");
                    toast({ title: "Error", description: err?.message || "Failed to claim code.", variant: "destructive" });
                  }
                }}>
                {claimPromoMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Gift className="w-4 h-4 mr-2" />}
                Claim Reward
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Magic Boxes */}
      {(categoryFilter === "all" || categoryFilter === "task") && magicBoxes.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
            <span className="text-2xl">🎁</span> Magic Boxes
          </h2>
          <div className="space-y-3">
            {magicBoxes.map((box: any) => (
              <MagicBoxComponent
                key={box.id}
                box={box}
                entered={box.id in myBoxEntries}
                claimed={myBoxEntries[box.id] === true}
              />
            ))}
          </div>
        </div>
      )}

      {/* Activities */}
      <h2 className="text-lg font-semibold text-foreground mb-3">
        Community Activities
      </h2>

      {/* Category filter chips */}
      <div className="mb-4 overflow-x-auto scrollbar-hide">
        <div className="flex gap-2 pb-2">
          {["all", "meeting", "workshop", "event", "outreach", "promo", "task"].map((cat) => (
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
            const isFull = activity.max_participants && activity.participant_count >= activity.max_participants;
            const isManuallyEnded = activity.status === "ended";
            return (
              <motion.div
                key={activity.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + index * 0.08 }}
              >
                <Card className={`gradient-card border-border/50 p-4 ${(isFull || isManuallyEnded) && !isLogged ? "opacity-60" : ""}`}>
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
                        {(isFull || isManuallyEnded) && !isLogged && (
                          <Badge className="bg-muted text-muted-foreground text-[10px]">Ended</Badge>
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
                      {activity.max_participants ? (
                        <span className="flex items-center gap-1">
                          {activity.participant_count}/{activity.max_participants} claimed
                        </span>
                      ) : activity.participant_count > 0 ? (
                        <span className="flex items-center gap-1">
                          {activity.participant_count} claimed
                        </span>
                      ) : null}
                    </div>

                    {isLogged ? (
                      <Badge className="bg-primary/20 text-primary border-primary/30">
                        Logged
                      </Badge>
                    ) : isFull || isManuallyEnded ? (
                      <Badge className="bg-muted text-muted-foreground border-border">
                        Ended
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
