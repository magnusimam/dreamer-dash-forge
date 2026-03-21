import { useState, useEffect, useRef } from "react";
import { AnimatePresence } from "framer-motion";
import BottomNav from "@/components/BottomNav";
import Home from "@/pages/Home";
import ActivityLog from "@/pages/ActivityLog";
import Hackathons from "@/pages/Hackathons";
import Redeem from "@/pages/Redeem";
import Profile from "@/pages/Profile";
import Admin from "@/pages/Admin";
import Transfer from "@/pages/Transfer";
import Leaderboard from "@/pages/Leaderboard";
import Transactions from "@/pages/Transactions";
import RedemptionHistory from "@/pages/RedemptionHistory";
import Onboarding from "@/pages/Onboarding";
import { showBackButton, hideBackButton, getStartParam } from "@/lib/telegram";
import { useUser } from "@/contexts/UserContext";
import { useProcessReferral } from "@/hooks/useSupabase";
import { useToast } from "@/hooks/use-toast";

const SUB_TABS = new Set(["admin", "transfer", "leaderboard", "transactions", "redemption-history"]);

const ONBOARDING_KEY = "dreamer_dash_onboarded";

const REFERRAL_PROCESSED_KEY = "dreamer_dash_referral_processed";

const Index = () => {
  const [activeTab, setActiveTab] = useState("home");
  const { dbUser, loading } = useUser();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const processReferral = useProcessReferral();
  const { toast } = useToast();
  const referralProcessedRef = useRef(false);

  // Check if first-time user
  useEffect(() => {
    if (!loading && dbUser) {
      const onboarded = localStorage.getItem(ONBOARDING_KEY);
      if (!onboarded) {
        setShowOnboarding(true);
      }

      // Process referral deep link
      if (!referralProcessedRef.current && !localStorage.getItem(REFERRAL_PROCESSED_KEY)) {
        const startParam = getStartParam();
        if (startParam && startParam.startsWith("ref_")) {
          referralProcessedRef.current = true;
          const referralCode = startParam.slice(4); // Remove "ref_" prefix
          processReferral
            .mutateAsync(referralCode)
            .then(() => {
              localStorage.setItem(REFERRAL_PROCESSED_KEY, "true");
              toast({
                title: "Referral Applied!",
                description: `You were referred with code ${referralCode}. Bonus credited!`,
              });
            })
            .catch(() => {
              // Referral may be invalid or already used — silently ignore
            });
        }
      }
    }
  }, [loading, dbUser]);

  const handleOnboardingComplete = () => {
    localStorage.setItem(ONBOARDING_KEY, "true");
    setShowOnboarding(false);
  };

  useEffect(() => {
    if (SUB_TABS.has(activeTab)) {
      const backTo = activeTab === "admin" ? "profile"
        : activeTab === "transfer" || activeTab === "leaderboard" ? "profile"
        : activeTab === "redemption-history" ? "redeem"
        : "home";
      showBackButton(() => setActiveTab(backTo));
    } else {
      hideBackButton();
    }
    return () => hideBackButton();
  }, [activeTab]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 gradient-primary rounded-full flex items-center justify-center shadow-glow mx-auto mb-4 animate-pulse">
            <span className="text-primary-foreground font-bold text-lg">DR</span>
          </div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (showOnboarding) {
    return <Onboarding onComplete={handleOnboardingComplete} />;
  }

  const renderCurrentPage = () => {
    switch (activeTab) {
      case "home":
        return <Home onTabChange={setActiveTab} />;
      case "activities":
        return <ActivityLog />;
      case "hackathons":
        return <Hackathons />;
      case "redeem":
        return <Redeem onTabChange={setActiveTab} />;
      case "profile":
        return <Profile onTabChange={setActiveTab} />;
      case "admin":
        return <Admin />;
      case "transfer":
        return <Transfer />;
      case "leaderboard":
        return <Leaderboard />;
      case "transactions":
        return <Transactions />;
      case "redemption-history":
        return <RedemptionHistory />;
      default:
        return <Home onTabChange={setActiveTab} />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <AnimatePresence mode="wait">{renderCurrentPage()}</AnimatePresence>
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
};

export default Index;
