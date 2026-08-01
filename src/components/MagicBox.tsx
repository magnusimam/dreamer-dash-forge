import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useOpenMagicBox, useClaimMagicBox } from "@/hooks/useSupabase";
import { useUser } from "@/contexts/UserContext";
import { Loader2, Sparkles, Lock, Clock, Users } from "lucide-react";
import { hapticNotification } from "@/lib/telegram";
import { Confetti } from "@/components/Confetti";

interface MagicBoxProps {
  box: any;
  entered: boolean;
  claimed: boolean;
}

function useCountdown(targetDate: string | null) {
  const [timeLeft, setTimeLeft] = useState("");
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!targetDate) { setIsReady(true); return; }
    const target = new Date(targetDate).getTime();
    const update = () => {
      const now = Date.now();
      const diff = target - now;
      if (diff <= 0) { setTimeLeft("NOW!"); setIsReady(true); return; }
      const hours = Math.floor(diff / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      if (hours > 0) setTimeLeft(`${hours}h ${mins}m ${secs}s`);
      else if (mins > 0) setTimeLeft(`${mins}m ${secs}s`);
      else setTimeLeft(`${secs}s`);
      setIsReady(false);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  return { timeLeft, isReady };
}

export default function MagicBox({ box, entered, claimed }: MagicBoxProps) {
  const { toast } = useToast();
  const { dbUser } = useUser();
  const openMutation = useOpenMagicBox();
  const claimMutation = useClaimMagicBox();
  const { timeLeft, isReady } = useCountdown(box.reveal_at);
  const [phase, setPhase] = useState<"idle" | "entering" | "waiting" | "opening" | "reveal" | "claimed">("idle");
  const [showConfetti, setShowConfetti] = useState(false);

  // Determine initial phase
  useEffect(() => {
    if (claimed) setPhase("claimed");
    else if (entered && isReady) setPhase("reveal");
    else if (entered) setPhase("waiting");
    else setPhase("idle");
  }, [entered, claimed, isReady]);

  const balance = dbUser?.balance ?? 0;
  const isFull = box.max_entries && box.entry_count >= box.max_entries;

  const handleEnter = async () => {
    try {
      setPhase("entering");
      const result = await openMutation.mutateAsync(box.id);
      if (result?.success) {
        hapticNotification("success");
        toast({ title: "You're in!", description: `Entered ${result.title}. ${box.reveal_at ? "Wait for reveal!" : ""}` });
        if (isReady) setPhase("reveal");
        else setPhase("waiting");
      } else {
        setPhase("idle");
        hapticNotification("error");
        toast({ title: "Failed", description: result?.error, variant: "destructive" });
      }
    } catch (err: any) {
      setPhase("idle");
      hapticNotification("error");
      toast({ title: "Error", description: err?.message, variant: "destructive" });
    }
  };

  const handleClaim = async () => {
    try {
      setPhase("opening");
      hapticNotification("warning");
      // Wait for opening animation
      await new Promise((r) => setTimeout(r, 2000));
      const result = await claimMutation.mutateAsync(box.id);
      if (result?.success) {
        hapticNotification("success");
        setShowConfetti(true);
        setPhase("claimed");
        const parts = [];
        if (result.prize_dr > 0) parts.push(`+${result.prize_dr} DR`);
        if (result.prize_xp > 0) parts.push(`+${result.prize_xp} XP`);
        if (box.prize_custom) parts.push(box.prize_custom);
        toast({ title: "Prize Claimed!", description: parts.join(" · ") || "Congratulations!" });
      } else {
        setPhase("reveal");
        toast({ title: "Failed", description: result?.error, variant: "destructive" });
      }
    } catch (err: any) {
      setPhase("reveal");
      toast({ title: "Error", description: err?.message, variant: "destructive" });
    }
  };

  const shakeKeyframes = {
    idle: { rotate: [0, -2, 2, -2, 2, 0], transition: { repeat: Infinity, duration: 2, ease: "easeInOut" } },
    entering: { rotate: [0, -5, 5, -5, 5, 0], scale: [1, 1.05, 0.95, 1], transition: { repeat: Infinity, duration: 0.5 } },
    opening: { rotate: [0, -10, 10, -15, 15, -20, 20, -10, 10, 0], scale: [1, 1.1, 0.9, 1.15, 0.85, 1.2, 0.8, 1.3, 1], transition: { duration: 2 } },
  };

  return (
    <Card className="gradient-card border-border/50 p-4 overflow-hidden relative">
      {/* Gold glow on reveal */}
      {(phase === "reveal" || phase === "opening") && (
        <motion.div
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 0.2, scale: 4 }}
          transition={{ duration: 1.5 }}
          className="absolute rounded-full blur-3xl pointer-events-none bg-yellow-400"
          style={{ width: 100, height: 100, left: "50%", top: "50%", marginLeft: -50, marginTop: -50 }}
        />
      )}

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-foreground text-sm">{box.title}</h3>
          <div className="flex items-center gap-1">
            <Badge variant="outline" className="text-[10px]">
              <Users className="w-2.5 h-2.5 mr-0.5" />{box.entry_count}{box.max_entries ? `/${box.max_entries}` : ""}
            </Badge>
          </div>
        </div>
        {box.description && <p className="text-xs text-muted-foreground mb-3">{box.description}</p>}

        {/* Box Visual */}
        <div className="flex justify-center py-6">
          {phase === "claimed" ? (
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", bounce: 0.5 }} className="text-center">
              <div className="w-20 h-20 mx-auto rounded-2xl bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
                <span className="text-3xl">✅</span>
              </div>
              <p className="text-xs text-emerald-400 mt-2 font-medium">Claimed!</p>
            </motion.div>
          ) : phase === "reveal" ? (
            <div className="text-center">
              <motion.div
                animate={{ scale: [1, 1.05, 1], boxShadow: ["0 0 20px rgba(234,179,8,0.3)", "0 0 50px rgba(234,179,8,0.6)", "0 0 20px rgba(234,179,8,0.3)"] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="w-28 min-h-[7rem] mx-auto rounded-2xl bg-gradient-to-br from-yellow-400 via-amber-500 to-yellow-600 flex flex-col items-center justify-center shadow-2xl border-2 border-yellow-300 px-3 py-3"
              >
                {box.prize_dr > 0 && <p className="text-2xl font-black text-white drop-shadow-lg">{box.prize_dr.toLocaleString()}</p>}
                {box.prize_dr > 0 && <p className="text-[10px] font-bold text-yellow-100">DR</p>}
                {box.prize_xp > 0 && <p className="text-lg font-black text-white drop-shadow-lg">+{box.prize_xp} XP</p>}
                {box.prize_custom && <p className="text-sm font-bold text-white drop-shadow-lg text-center leading-tight mt-1">{box.prize_custom}</p>}
              </motion.div>
              <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-xs text-yellow-400 mt-2 font-medium">
                Tap to claim your prize!
              </motion.p>
            </div>
          ) : (
            <motion.div animate={shakeKeyframes[phase === "opening" ? "opening" : phase === "entering" ? "entering" : "idle"]} className="text-center">
              <div className="w-20 h-20 mx-auto relative">
                <div className="absolute inset-0 bg-gradient-to-br from-yellow-500 to-amber-600 rounded-lg shadow-lg border-2 border-yellow-400/50" />
                <motion.div
                  animate={phase === "opening" ? { y: [-2, -15, -30], rotate: [-5, 15, 30], opacity: [1, 1, 0] } : { y: [0, -3, 0] }}
                  transition={phase === "opening" ? { duration: 1.5, delay: 0.5 } : { repeat: Infinity, duration: 1 }}
                  className="absolute top-0 left-0 right-0 h-5 bg-gradient-to-br from-yellow-400 to-amber-500 rounded-t-lg border-b-2 border-yellow-600/30"
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-3xl">{phase === "opening" ? "✨" : "🎁"}</span>
                </div>
                <motion.div animate={{ scale: [1, 1.3, 1] }} transition={{ repeat: Infinity, duration: 1.5 }} className="absolute -top-1 -right-1">
                  <Sparkles className="w-4 h-4 text-yellow-300" />
                </motion.div>
              </div>
              {phase === "waiting" && (
                <div className="mt-3">
                  <p className="text-xs text-yellow-400 font-medium flex items-center justify-center gap-1">
                    <Clock className="w-3 h-3" /> Opens in {timeLeft}
                  </p>
                  <p className="text-[10px] text-muted-foreground">You're in! Wait for reveal...</p>
                </div>
              )}
              {phase === "idle" && !isFull && box.reveal_at && (
                <p className="text-[10px] text-muted-foreground mt-2 flex items-center justify-center gap-1">
                  <Clock className="w-3 h-3" /> Reveals in {timeLeft}
                </p>
              )}
              {phase === "idle" && !box.reveal_at && <p className="text-[10px] text-muted-foreground mt-2">What's inside?</p>}
              {phase === "opening" && <p className="text-xs text-primary mt-2 font-medium animate-pulse">Opening...</p>}
            </motion.div>
          )}
        </div>

        {/* Action Buttons */}
        {phase === "idle" && (
          isFull ? (
            <Badge className="w-full justify-center bg-muted text-muted-foreground h-9">Full</Badge>
          ) : (
            <Button className="w-full bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-600 hover:to-amber-700 text-white font-semibold shadow-lg" disabled={balance < box.entry_fee || openMutation.isPending} onClick={handleEnter}>
              {openMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Lock className="w-4 h-4 mr-2" />}
              Enter for {box.entry_fee} DR
            </Button>
          )
        )}

        {phase === "entering" && (
          <Button disabled className="w-full bg-amber-600 text-white">
            <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Entering...
          </Button>
        )}

        {phase === "waiting" && (
          <Badge className="w-full justify-center bg-yellow-500/20 text-yellow-400 border-yellow-500/30 h-9">
            <Clock className="w-3.5 h-3.5 mr-1.5" /> Waiting for reveal — {timeLeft}
          </Badge>
        )}

        {phase === "reveal" && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-lg" disabled={claimMutation.isPending} onClick={handleClaim}>
              {claimMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
              Open & Claim Prize
            </Button>
          </motion.div>
        )}

        {phase === "opening" && (
          <Button disabled className="w-full bg-amber-600 text-white">
            <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Opening...
          </Button>
        )}
      </div>

      <Confetti active={showConfetti} onComplete={() => setShowConfetti(false)} />
    </Card>
  );
}
