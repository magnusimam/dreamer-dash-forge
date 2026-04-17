import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useOpenMagicBox, useClaimMagicBox } from "@/hooks/useSupabase";
import { useUser } from "@/contexts/UserContext";
import { Loader2, Coins, Sparkles, X, Lock } from "lucide-react";
import { hapticNotification } from "@/lib/telegram";
import { Confetti } from "@/components/Confetti";

interface MagicBoxProps {
  box: any;
  opened: boolean;
  claimed: boolean;
}

const shakeAnimation = {
  animate: {
    rotate: [0, -3, 3, -3, 3, -2, 2, 0],
    transition: { repeat: Infinity, duration: 1.5, ease: "easeInOut" },
  },
};

const openingShake = {
  animate: {
    rotate: [0, -8, 8, -10, 10, -12, 12, -15, 15, 0],
    scale: [1, 1.05, 0.95, 1.1, 0.9, 1.15, 0.85, 1.2, 1],
    transition: { duration: 1.5, ease: "easeInOut" },
  },
};

export default function MagicBox({ box, opened, claimed }: MagicBoxProps) {
  const { toast } = useToast();
  const { dbUser } = useUser();
  const openMutation = useOpenMagicBox();
  const claimMutation = useClaimMagicBox();
  const [phase, setPhase] = useState<"idle" | "opening" | "reveal" | "claimed">(
    claimed ? "claimed" : opened ? "reveal" : "idle"
  );
  const [prize, setPrize] = useState<{ dr: number; xp: number } | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);

  const balance = dbUser?.balance ?? 0;
  const isFull = box.max_entries && box.entry_count >= box.max_entries;

  const handleOpen = async () => {
    try {
      setPhase("opening");
      hapticNotification("warning");
      const result = await openMutation.mutateAsync(box.id);
      if (result?.success) {
        setPrize({ dr: result.prize_dr, xp: result.prize_xp });
        setTimeout(() => {
          hapticNotification("success");
          setPhase("reveal");
        }, 1800);
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
      const result = await claimMutation.mutateAsync(box.id);
      if (result?.success) {
        hapticNotification("success");
        setShowConfetti(true);
        setPhase("claimed");
        toast({ title: "Prize Claimed!", description: `${result.prize_dr > 0 ? `+${result.prize_dr} DR` : ""}${result.prize_xp > 0 ? ` +${result.prize_xp} XP` : ""}` });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err?.message, variant: "destructive" });
    }
  };

  return (
    <Card className="gradient-card border-border/50 p-4 overflow-hidden relative">
      {/* Background glow for reveal */}
      {phase === "reveal" && (
        <motion.div
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 0.3, scale: 3 }}
          transition={{ duration: 1 }}
          className="absolute inset-0 bg-yellow-400 rounded-full blur-3xl pointer-events-none"
          style={{ left: "50%", top: "50%", transform: "translate(-50%, -50%)" }}
        />
      )}

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-foreground text-sm">{box.title}</h3>
          <div className="flex items-center gap-1">
            {box.entry_count > 0 && <Badge variant="outline" className="text-[10px]">{box.entry_count}{box.max_entries ? `/${box.max_entries}` : ""} opened</Badge>}
          </div>
        </div>
        {box.description && <p className="text-xs text-muted-foreground mb-3">{box.description}</p>}

        {/* Box Animation */}
        <div className="flex justify-center py-4">
          {phase === "idle" && (
            <motion.div {...shakeAnimation} className="text-center cursor-pointer">
              <div className="w-20 h-20 mx-auto relative">
                <div className="absolute inset-0 bg-gradient-to-br from-yellow-500 to-amber-600 rounded-lg shadow-lg border-2 border-yellow-400/50" />
                <div className="absolute top-0 left-0 right-0 h-5 bg-gradient-to-br from-yellow-400 to-amber-500 rounded-t-lg border-b-2 border-yellow-600/30" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-3xl">🎁</span>
                </div>
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className="absolute -top-1 -right-1 w-4 h-4"
                >
                  <Sparkles className="w-4 h-4 text-yellow-300" />
                </motion.div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">What's inside?</p>
            </motion.div>
          )}

          {phase === "opening" && (
            <motion.div {...openingShake} className="text-center">
              <div className="w-20 h-20 mx-auto relative">
                <div className="absolute inset-0 bg-gradient-to-br from-yellow-500 to-amber-600 rounded-lg shadow-lg border-2 border-yellow-400/50" />
                <motion.div
                  animate={{ y: [-2, -8, -2], rotate: [-5, 5, -5] }}
                  transition={{ repeat: Infinity, duration: 0.3 }}
                  className="absolute top-0 left-0 right-0 h-5 bg-gradient-to-br from-yellow-400 to-amber-500 rounded-t-lg border-b-2 border-yellow-600/30"
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-3xl">🎁</span>
                </div>
              </div>
              <p className="text-xs text-primary mt-2 font-medium animate-pulse">Opening...</p>
            </motion.div>
          )}

          {phase === "reveal" && prize && (
            <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", bounce: 0.5, delay: 0.2 }} className="text-center">
              <motion.div
                animate={{ scale: [1, 1.05, 1], boxShadow: ["0 0 20px rgba(234,179,8,0.3)", "0 0 40px rgba(234,179,8,0.6)", "0 0 20px rgba(234,179,8,0.3)"] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="w-24 h-24 mx-auto rounded-2xl bg-gradient-to-br from-yellow-400 via-amber-500 to-yellow-600 flex flex-col items-center justify-center shadow-2xl border-2 border-yellow-300"
              >
                {prize.dr > 0 && <p className="text-2xl font-black text-white drop-shadow-lg">{prize.dr.toLocaleString()}</p>}
                {prize.dr > 0 && <p className="text-[10px] font-bold text-yellow-100">DR</p>}
                {prize.xp > 0 && <p className="text-lg font-black text-white drop-shadow-lg">+{prize.xp} XP</p>}
              </motion.div>
              <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="text-xs text-yellow-400 mt-2 font-medium">
                You found a prize!
              </motion.p>
            </motion.div>
          )}

          {phase === "claimed" && (
            <div className="text-center">
              <div className="w-20 h-20 mx-auto rounded-2xl bg-emerald-500/20 flex items-center justify-center">
                <span className="text-3xl">✅</span>
              </div>
              <p className="text-xs text-emerald-400 mt-2 font-medium">Claimed!</p>
            </div>
          )}
        </div>

        {/* Action Button */}
        {phase === "idle" && (
          isFull ? (
            <Badge className="w-full justify-center bg-muted text-muted-foreground h-9">Full</Badge>
          ) : (
            <Button className="w-full bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-600 hover:to-amber-700 text-white font-semibold shadow-lg" disabled={balance < box.entry_fee || openMutation.isPending} onClick={handleOpen}>
              {openMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Lock className="w-4 h-4 mr-2" />}
              Open for {box.entry_fee} DR
            </Button>
          )
        )}

        {phase === "opening" && (
          <Button disabled className="w-full bg-amber-600 text-white">
            <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Opening...
          </Button>
        )}

        {phase === "reveal" && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }}>
            <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-lg" disabled={claimMutation.isPending} onClick={handleClaim}>
              {claimMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
              Claim Prize
            </Button>
          </motion.div>
        )}
      </div>

      <Confetti active={showConfetti} onComplete={() => setShowConfetti(false)} />
    </Card>
  );
}
