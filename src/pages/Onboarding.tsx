import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ClipboardList, Gift, Trophy, Rocket, Users } from "lucide-react";
import logoImg from "@/assets/dreamers-coin-logo.png";
import { useProcessReferral } from "@/hooks/useSupabase";
import { useToast } from "@/hooks/use-toast";

interface OnboardingProps {
  onComplete: () => void;
}

const steps = [
  {
    icon: null,
    image: logoImg,
    title: "Welcome to Dreamer Dash",
    description: "Your community rewards hub. Earn Dreamers Coins (DR) by participating in activities, completing missions, and daily check-ins.",
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
  const [referralCode, setReferralCode] = useState("");
  const [referralApplied, setReferralApplied] = useState(false);
  const processReferral = useProcessReferral();
  const { toast } = useToast();

  const current = steps[step];
  const Icon = current.icon;
  const isLast = step === steps.length - 1;

  const handleApplyReferral = async () => {
    const code = referralCode.trim().toUpperCase();
    if (!code) return;
    try {
      const result = await processReferral.mutateAsync(code);
      if (result?.success) {
        setReferralApplied(true);
        toast({ title: "Referral Applied!", description: `+20 DR welcome bonus credited!` });
      } else {
        toast({ title: "Invalid code", description: result?.error || "Check the code and try again.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Invalid code", description: "Check the code and try again.", variant: "destructive" });
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

      {/* Referral code input on last step */}
      {isLast && !referralApplied && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm mb-6"
        >
          <div className="bg-secondary/50 rounded-xl p-4 border border-border/50">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-foreground">Have a referral code?</span>
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="e.g. DR-7609C77C"
                value={referralCode}
                onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                className="bg-background border-border text-sm"
              />
              <Button
                size="sm"
                className="bg-primary hover:bg-primary/90 text-primary-foreground px-4"
                onClick={handleApplyReferral}
                disabled={!referralCode.trim() || processReferral.isPending}
              >
                {processReferral.isPending ? "..." : "Apply"}
              </Button>
            </div>
          </div>
        </motion.div>
      )}

      {isLast && referralApplied && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-sm mb-6"
        >
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 text-center">
            <p className="text-sm text-emerald-400 font-medium">Referral applied! +20 DR credited</p>
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
        <Button
          className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground shadow-glow"
          onClick={() => {
            if (isLast) {
              onComplete();
            } else {
              setStep(step + 1);
            }
          }}
        >
          {isLast ? (
            <>
              <Rocket className="w-5 h-5 mr-2" />
              Get Started
            </>
          ) : (
            "Next"
          )}
        </Button>

        {!isLast && (
          <Button
            variant="ghost"
            className="w-full text-muted-foreground"
            onClick={onComplete}
          >
            Skip
          </Button>
        )}
      </div>
    </div>
  );
}
