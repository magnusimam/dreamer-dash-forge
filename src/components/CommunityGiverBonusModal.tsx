import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Confetti } from "@/components/Confetti";
import { useCommunityGiverBonus, useClaimCommunityGiverBonus } from "@/hooks/useSupabase";
import { useUser } from "@/contexts/UserContext";
import { HeartHandshake, Loader2, X } from "lucide-react";

interface Props {
  active: boolean;
  onDone: () => void;
}

export default function CommunityGiverBonusModal({ active, onDone }: Props) {
  const { dbUser } = useUser();
  const { data } = useCommunityGiverBonus();
  const claimMutation = useClaimCommunityGiverBonus();
  const [claimedResult, setClaimedResult] = useState<{ naira_given: number; dr_reward: number; is_topup: boolean } | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    if (!active || data === undefined || claimedResult) return;
    if (!data?.eligible) onDone();
  }, [active, data, claimedResult, onDone]);

  const showSuccess = !!claimedResult;
  const shouldShow = active && data?.eligible;

  if (!shouldShow && !showSuccess) return null;

  const nairaGiven = claimedResult?.naira_given ?? data?.naira_given;
  const drReward = claimedResult?.dr_reward ?? data?.dr_reward;
  const isTopup = claimedResult?.is_topup ?? data?.is_topup;
  const initials = [dbUser?.first_name?.[0], dbUser?.last_name?.[0]].filter(Boolean).join("");

  const handleClaim = async () => {
    try {
      const result = await claimMutation.mutateAsync();
      if (result?.success) {
        setClaimedResult({ naira_given: result.naira_given, dr_reward: result.dr_reward, is_topup: result.is_topup });
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
          <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-amber-500/20 to-transparent pointer-events-none" />

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
            <Avatar className="w-20 h-20 mx-auto mb-4 border-2 border-amber-500 shadow-glow">
              <AvatarImage src={dbUser?.photo_url ?? undefined} />
              <AvatarFallback className="bg-amber-500/20 text-amber-500 text-2xl">{initials}</AvatarFallback>
            </Avatar>

            <div className="inline-flex items-center gap-1.5 bg-amber-500/15 text-amber-500 text-xs font-semibold px-3 py-1 rounded-full mb-3">
              <HeartHandshake className="w-3.5 h-3.5" />
              {isTopup ? "New Bonus Unlocked" : "Community Giver"}
            </div>

            <h2 className="text-xl font-bold text-foreground mb-1">
              {showSuccess ? "Bonus Claimed! 🎉" : isTopup ? "You've Got More Coming! 💝" : "Thank You For Giving! 💝"}
            </h2>
            <p className="text-sm text-muted-foreground mb-5">
              {isTopup
                ? `We updated your giving total — you've now got ${drReward?.toLocaleString()} more DR waiting.`
                : `You've put ₦${nairaGiven?.toLocaleString()} of your own money into this community. Here's a little back.`}
            </p>

            <div className="bg-secondary rounded-xl p-4 mb-5">
              <p className="text-xs text-muted-foreground mb-1">
                {showSuccess ? "Added to your balance" : "You've earned"}
              </p>
              <p className="text-3xl font-bold text-amber-500">+{drReward?.toLocaleString()} DR</p>
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
