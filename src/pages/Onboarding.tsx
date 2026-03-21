import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Coins, ClipboardList, Gift, Trophy, Rocket } from "lucide-react";

interface OnboardingProps {
  onComplete: () => void;
}

const steps = [
  {
    icon: Coins,
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
  const current = steps[step];
  const Icon = current.icon;
  const isLast = step === steps.length - 1;

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
          <div className={`w-24 h-24 rounded-full bg-gradient-to-r ${current.color} flex items-center justify-center shadow-lg mb-8`}>
            <Icon className="w-12 h-12 text-white" />
          </div>

          <h2 className="text-2xl font-bold text-foreground mb-4">
            {current.title}
          </h2>

          <p className="text-muted-foreground leading-relaxed mb-8">
            {current.description}
          </p>
        </motion.div>
      </AnimatePresence>

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
