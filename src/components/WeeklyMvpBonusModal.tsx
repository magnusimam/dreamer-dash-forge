import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Confetti } from "@/components/Confetti";
import { useWeeklyMvpBonus, useClaimWeeklyMvpBonus } from "@/hooks/useSupabase";
import { useUser } from "@/contexts/UserContext";
import { Trophy, Loader2, X } from "lucide-react";

interface Props {
  active: boolean;
  onDone: () => void;
}

export default function WeeklyMvpBonusModal({ active, onDone }: Props) {
  const { dbUser } = useUser();
  const { data } = useWeeklyMvpBonus();
  const claimMutation = useClaimWeeklyMvpBonus();
  const [claimedResult, setClaimedResult] = useState<{ wins: number; dr_reward: number; is_topup: boolean } | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    if (!active || data === undefined || claimedResult) return;
    if (!data?.eligible) onDone();
  }, [active, data, claimedResult, onDone]);

  const showSuccess = !!claimedResult;
  const shouldShow = active && data?.eligible;

  if (!shouldShow && !showSuccess) return null;

  const wins = claimedResult?.wins ?? data?.wins;
  const drReward = claimedResult?.dr_reward ?? data?.dr_reward;
  const isTopup = claimedResult?.is_topup ?? data?.is_topup;
  const initials = [dbUser?.first_name?.[0], dbUser?.last_name?.[0]].filter(Boolean).join("");

  const handleClaim = async () => {
    try {
      const result = await claimMutation.mutateAsync();
      if (result?.success) {
        setClaimedResult({ wins: result.wins, dr_reward: result.dr_reward, is_topup: result.is_topup });
        setShowConfetti(true);
      }
    } catch {
      // button re-enables; user can retry
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[70] flex items-center justify-center p-4"
      >
        <Confetti active={showConfetti} onComplete={() => setShowConfetti(false)} />
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 12 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: "spring", damping: 22, stiffness: 300 }}
          className="relative w-full max-w-sm bg-card border border-border rounded-2xl p-6 pt-10 text-center overflow-hidden"
        >
          <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-yellow-500/20 to-transparent pointer-events-none" />

          {!showSuccess && (
            <button
              onClick={onDone}
              className="absolute top-3 right-3 text-muted-foreground hover:text-foreground p-1"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          <div className="relative">
            <Avatar className="w-20 h-20 mx-auto mb-4 border-2 border-yellow-500 shadow-glow">
              <AvatarImage src={dbUser?.photo_url ?? undefined} />
              <AvatarFallback className="bg-yellow-500/20 text-yellow-500 text-2xl">{initials}</AvatarFallback>
            </Avatar>

            <div className="inline-flex items-center gap-1.5 bg-yellow-500/15 text-yellow-500 text-xs font-semibold px-3 py-1 rounded-full mb-3">
              <Trophy className="w-3.5 h-3.5" />
              {wins} {wins === 1 ? "week" : "weeks"} as MVP
            </div>

            <h2 className="text-xl font-bold text-foreground mb-1">
              {showSuccess ? "Bonus Claimed! 🎉" : isTopup ? "Another MVP Bonus! 🏆" : "Weekly MVP Bonus! 🏆"}
            </h2>
            <p className="text-sm text-muted-foreground mb-5">
              {isTopup
                ? `You've racked up more MVP weeks since your last claim — here's the extra.`
                : `You've been Weekly MVP ${wins} ${wins === 1 ? "time" : "times"}. That's real consistency.`}
            </p>

            <div className="bg-secondary rounded-xl p-4 mb-5">
              <p className="text-xs text-muted-foreground mb-1">
                {showSuccess ? "Added to your balance" : "You've earned"}
              </p>
              <p className="text-3xl font-bold text-yellow-500">+{drReward?.toLocaleString()} DR</p>
            </div>

            {showSuccess ? (
              <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground" onClick={onDone}>
                Nice!
              </Button>
            ) : (
              <Button
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                disabled={claimMutation.isPending}
                onClick={handleClaim}
              >
                {claimMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Claim {drReward?.toLocaleString()} DR
              </Button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
