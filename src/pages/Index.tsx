import { useState, useEffect, useRef } from "react";
import { AnimatePresence } from "framer-motion";
import BottomNav from "@/components/BottomNav";
import Home from "@/pages/Home";
import ActivityLog from "@/pages/ActivityLog";
import Hackathons from "@/pages/Hackathons";
import Raffles from "@/pages/Raffles";
import Redeem from "@/pages/Redeem";
import Profile from "@/pages/Profile";
import Admin from "@/pages/Admin";
import Transfer from "@/pages/Transfer";
import Leaderboard from "@/pages/Leaderboard";
import Transactions from "@/pages/Transactions";
import RedemptionHistory from "@/pages/RedemptionHistory";
import Onboarding from "@/pages/Onboarding";
import SupplyDashboard from "@/pages/SupplyDashboard";
import States from "@/pages/States";
import { showBackButton, hideBackButton } from "@/lib/telegram";
import { useUser } from "@/contexts/UserContext";
import { useHeartbeat } from "@/hooks/useSupabase";
import logoImg from "@/assets/dreamers-coin-logo.png";
import { supabase } from "@/lib/supabase";

const SUB_TABS = new Set(["admin", "transfer", "leaderboard", "transactions", "redemption-history", "supply", "states", "hackathons"]);

const ONBOARDING_KEY = "dreamer_dash_onboarded";

const Index = () => {
  const [activeTab, setActiveTab] = useState("home");
  const { dbUser, loading } = useUser();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [checkingReferral, setCheckingReferral] = useState(true);
  const scrollPositions = useRef<Record<string, number>>({});

  // Heartbeat — updates last_active every 60s while app is open
  useHeartbeat();

  const handleTabChange = (tab: string) => {
    scrollPositions.current[activeTab] = window.scrollY;
    setActiveTab(tab);
  };

  // Check if user has been referred (mandatory gate)
  useEffect(() => {
    if (!loading && dbUser) {
      const checkAccess = async () => {
        // Admins always have access
        if (dbUser.is_admin) {
          setCheckingReferral(false);
          localStorage.setItem(ONBOARDING_KEY, "true");
          return;
        }

        // Check if user exists in referrals table as referred_id
        const { data } = await supabase
          .from("referrals")
          .select("id")
          .eq("referred_id", dbUser.id)
          .maybeSingle();

        if (data) {
          // User has been referred — grant access, set flag so we don't check again
          setCheckingReferral(false);
          localStorage.setItem(ONBOARDING_KEY, "true");
        } else {
          // Not referred — must complete onboarding with referral code
          setCheckingReferral(false);
          setShowOnboarding(true);
        }
      };

      checkAccess();
    }
  }, [loading, dbUser]);

  const handleOnboardingComplete = () => {
    localStorage.setItem(ONBOARDING_KEY, "true");
    setShowOnboarding(false);
  };

  // Scroll restoration
  useEffect(() => {
    const saved = scrollPositions.current[activeTab];
    if (saved) {
      requestAnimationFrame(() => window.scrollTo(0, saved));
    } else {
      window.scrollTo(0, 0);
    }
  }, [activeTab]);

  // Back button handling
  useEffect(() => {
    if (SUB_TABS.has(activeTab)) {
      const backTo = activeTab === "admin" ? "profile"
        : activeTab === "transfer" || activeTab === "leaderboard" ? "profile"
        : activeTab === "redemption-history" ? "redeem"
        : activeTab === "hackathons" ? "raffles"
        : activeTab === "states" ? "home"
        : "home";
      showBackButton(() => handleTabChange(backTo));
    } else {
      hideBackButton();
    }
    return () => hideBackButton();
  }, [activeTab]);

  // Loading state
  if (loading || checkingReferral) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <img src={logoImg} alt="Dreamer Dash" className="w-16 h-16 rounded-full shadow-glow mx-auto mb-4 animate-pulse object-cover" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Onboarding gate — mandatory referral
  if (showOnboarding) {
    return <Onboarding onComplete={handleOnboardingComplete} />;
  }

  const renderCurrentPage = () => {
    switch (activeTab) {
      case "home":
        return <Home onTabChange={handleTabChange} />;
      case "activities":
        return <ActivityLog />;
      case "raffles":
        return <Raffles onTabChange={handleTabChange} />;
      case "hackathons":
        return <Hackathons />;
      case "redeem":
        return <Redeem onTabChange={handleTabChange} />;
      case "profile":
        return <Profile onTabChange={handleTabChange} />;
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
      case "supply":
        return <SupplyDashboard />;
      case "states":
        return <States />;
      default:
        return <Home onTabChange={handleTabChange} />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <AnimatePresence mode="wait">{renderCurrentPage()}</AnimatePresence>
      <BottomNav activeTab={activeTab} onTabChange={handleTabChange} notifications={0} />
    </div>
  );
};

export default Index;
