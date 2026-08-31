import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Confetti } from "@/components/Confetti";
import { useAnniversaryTier, useClaimAnniversaryTierBonus } from "@/hooks/useSupabase";
import { useUser } from "@/contexts/UserContext";
import { PartyPopper, Loader2, X } from "lucide-react";

const TIER_COPY: Record<string, { label: string; blurb: string }> = {
  top20: { label: "Top 20% Most Active", blurb: "Nobody kept the streak alive like you did." },
  next30: { label: "Top 50% Most Active", blurb: "Solid run this season — you showed up." },
  active: { label: "Active Dreamer", blurb: "You've been part of the momentum. Thank you." },
};

export default function AnniversaryBonusModal() {
  const { dbUser } = useUser();
  const { data } = useAnniversaryTier();
  const claimMutation = useClaimAnniversaryTierBonus();
  const [dismissed, setDismissed] = useState(false);
  const [claimedResult, setClaimedResult] = useState<{ tier: string; dr_reward: number } | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);

  const shouldShow = !dismissed && data?.eligible && !data?.claimed && !claimedResult;
  const showSuccess = !!claimedResult;

  if (!shouldShow && !showSuccess) return null;

  const tier = claimedResult?.tier ?? data?.tier;
  const drReward = claimedResult?.dr_reward ?? data?.dr_reward;
  const copy = TIER_COPY[tier] ?? TIER_COPY.active;
  const initials = [dbUser?.first_name?.[0], dbUser?.last_name?.[0]].filter(Boolean).join("");

  const handleClaim = async () => {
    try {
      const result = await claimMutation.mutateAsync();
      if (result?.success) {
        setClaimedResult({ tier: result.tier, dr_reward: result.dr_reward });
        setShowConfetti(true);
      }
    } catch {
      // toast not needed here — button re-enables and user can retry
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
          <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-primary/20 to-transparent pointer-events-none" />

          {!showSuccess && (
            <button
              onClick={() => setDismissed(true)}
              className="absolute top-3 right-3 text-muted-foreground hover:text-foreground p-1"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          <div className="relative">
            <Avatar className="w-20 h-20 mx-auto mb-4 border-2 border-primary shadow-glow">
              <AvatarImage src={dbUser?.photo_url ?? undefined} />
              <AvatarFallback className="bg-primary/20 text-primary text-2xl">{initials}</AvatarFallback>
            </Avatar>

            <div className="inline-flex items-center gap-1.5 bg-primary/15 text-primary text-xs font-semibold px-3 py-1 rounded-full mb-3">
              <PartyPopper className="w-3.5 h-3.5" />
              {copy.label}
            </div>

            <h2 className="text-xl font-bold text-foreground mb-1">
              {showSuccess ? "Bonus Claimed! 🎉" : "Happy Anniversary! 🎉"}
            </h2>
            <p className="text-sm text-muted-foreground mb-5">{copy.blurb}</p>

            <div className="bg-secondary rounded-xl p-4 mb-5">
              <p className="text-xs text-muted-foreground mb-1">
                {showSuccess ? "Added to your balance" : "You've earned"}
              </p>
              <p className="text-3xl font-bold text-primary">+{drReward?.toLocaleString()} DR</p>
            </div>

            {showSuccess ? (
              <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground" onClick={() => setDismissed(true)}>
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
