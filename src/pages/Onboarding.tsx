import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ClipboardList, Gift, Trophy, Rocket, ShieldCheck, Loader2 } from "lucide-react";
import logoImg from "@/assets/dreamers-coin-logo.png";
import { useProcessReferral } from "@/hooks/useSupabase";
import { useToast } from "@/hooks/use-toast";
import { getStartParam } from "@/lib/telegram";

interface OnboardingProps {
  onComplete: () => void;
}

const steps = [
  {
    icon: null,
    image: logoImg,
    title: "Welcome to Dreamer Dash",
    description: "The exclusive rewards platform for the Dreamers community. You need a referral code from an existing member to join.",
    color: "from-primary to-yellow-500",
  },
  {
    icon: ClipboardList,
    title: "Log Activities",
    description: "Attend community events, enter your unique code, and earn DR instantly. Check in daily for bonus rewards and build your streak!",
    color: "from-blue-500 to-cyan-500",
  },
  {
    icon: Gift,
    title: "Redeem Rewards",
    description: "Spend your DR on airtime, data, cash transfers, books, mentorship sessions, courses, and more.",
    color: "from-purple-500 to-pink-500",
  },
  {
    icon: Trophy,
    title: "Climb the Ranks",
    description: "Level up from Bronze to Diamond. Compete on the leaderboard, transfer DR to friends, and join hackathons!",
    color: "from-emerald-500 to-green-500",
  },
];

export default function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(0);
  const [referralCode, setReferralCode] = useState(() => {
    // Pre-fill from deep link if available
    const param = getStartParam();
    if (param && param.startsWith("ref_")) return param.slice(4);
    return "";
  });
  const [referralApplied, setReferralApplied] = useState(false);
  const [error, setError] = useState("");
  const processReferral = useProcessReferral();
  const { toast } = useToast();

  const current = steps[step];
  const Icon = current.icon;
  const isLast = step === steps.length - 1;

  const handleApplyReferral = async () => {
    const code = referralCode.trim().toUpperCase();
    if (!code) {
      setError("Enter a referral code to continue");
      return;
    }
    setError("");
    try {
      const result = await processReferral.mutateAsync(code);
      if (result?.success) {
        setReferralApplied(true);
        toast({ title: "Welcome to Dreamer Dash!", description: "+20 DR welcome bonus credited!" });
      } else {
        setError(result?.error || "Invalid referral code. Ask a community member for theirs.");
      }
    } catch {
      setError("Invalid referral code. Ask a community member for theirs.");
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -50 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col items-center text-center max-w-sm"
        >
          {"image" in current && current.image ? (
            <img src={current.image} alt="" className="w-28 h-28 rounded-full shadow-glow object-cover mb-8" />
          ) : (
            <div className={`w-24 h-24 rounded-full bg-gradient-to-r ${current.color} flex items-center justify-center shadow-lg mb-8`}>
              {Icon && <Icon className="w-12 h-12 text-white" />}
            </div>
          )}

          <h2 className="text-2xl font-bold text-foreground mb-4">
            {current.title}
          </h2>

          <p className="text-muted-foreground leading-relaxed mb-8">
            {current.description}
          </p>
        </motion.div>
      </AnimatePresence>

      {/* Referral code — MANDATORY on last step */}
      {isLast && !referralApplied && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm mb-6"
        >
          <div className="bg-secondary/50 rounded-xl p-4 border border-primary/20">
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">Enter Referral Code</span>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              You need a referral code from an existing Dreamers member to join.
            </p>
            <div className="flex gap-2 mb-2">
              <Input
                placeholder="e.g. DR-7609C77C"
                value={referralCode}
                onChange={(e) => {
                  setReferralCode(e.target.value.toUpperCase());
                  if (error) setError("");
                }}
                className="bg-background border-border text-sm"
                onKeyDown={(e) => e.key === "Enter" && handleApplyReferral()}
              />
              <Button
                size="sm"
                className="bg-primary hover:bg-primary/90 text-primary-foreground px-4"
                onClick={handleApplyReferral}
                disabled={!referralCode.trim() || processReferral.isPending}
              >
                {processReferral.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Verify"}
              </Button>
            </div>
            {error && (
              <p className="text-xs text-destructive">{error}</p>
            )}
          </div>
        </motion.div>
      )}

      {isLast && referralApplied && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-sm mb-6"
        >
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 text-center">
            <ShieldCheck className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
            <p className="text-sm text-emerald-400 font-medium">Verified! Welcome to Dreamers</p>
            <p className="text-xs text-muted-foreground mt-1">+20 DR welcome bonus credited</p>
          </div>
        </motion.div>
      )}

      {/* Dots */}
      <div className="flex gap-2 mb-8">
        {steps.map((_, i) => (
          <div
            key={i}
            className={`w-2 h-2 rounded-full transition-all ${
              i === step ? "w-6 bg-primary" : "bg-border"
            }`}
          />
        ))}
      </div>

      {/* Buttons */}
      <div className="w-full max-w-sm space-y-3">
        {isLast ? (
          /* Last step — can only proceed if referral is applied */
          <Button
            className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground shadow-glow"
            onClick={onComplete}
            disabled={!referralApplied}
          >
            <Rocket className="w-5 h-5 mr-2" />
            Get Started
          </Button>
        ) : (
          <Button
            className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground shadow-glow"
            onClick={() => setStep(step + 1)}
          >
            Next
          </Button>
        )}

        {/* No skip button — referral is mandatory */}
      </div>
    </div>
  );
}
