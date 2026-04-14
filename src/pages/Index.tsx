import { useState, useEffect, useRef, lazy, Suspense } from "react";
import { AnimatePresence } from "framer-motion";
import BottomNav from "@/components/BottomNav";
import Home from "@/pages/Home";
import ActivityLog from "@/pages/ActivityLog";
import Raffles from "@/pages/Raffles";
import Redeem from "@/pages/Redeem";
import Profile from "@/pages/Profile";
import Onboarding from "@/pages/Onboarding";

// Lazy load sub-pages (only loaded when navigated to)
const Hackathons = lazy(() => import("@/pages/Hackathons"));
const Admin = lazy(() => import("@/pages/Admin"));
const Transfer = lazy(() => import("@/pages/Transfer"));
const Leaderboard = lazy(() => import("@/pages/Leaderboard"));
const Transactions = lazy(() => import("@/pages/Transactions"));
const RedemptionHistory = lazy(() => import("@/pages/RedemptionHistory"));
const SupplyDashboard = lazy(() => import("@/pages/SupplyDashboard"));
const States = lazy(() => import("@/pages/States"));
const UserSettings = lazy(() => import("@/pages/UserSettings"));
const Community = lazy(() => import("@/pages/Community"));
import { showBackButton, hideBackButton } from "@/lib/telegram";
import { useUser } from "@/contexts/UserContext";
import { useHeartbeat, useInactivityCheck } from "@/hooks/useSupabase";
import { notifyUser } from "@/lib/notifications";
import logoImg from "@/assets/dreamers-coin-logo.png";
import { supabase } from "@/lib/supabase";

const SUB_TABS = new Set(["admin", "transfer", "leaderboard", "transactions", "redemption-history", "supply", "states", "hackathons", "settings", "community"]);

const ONBOARDING_KEY = "dreamer_dash_onboarded";

const Index = () => {
  const [activeTab, setActiveTab] = useState("home");
  const { dbUser, loading } = useUser();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [checkingReferral, setCheckingReferral] = useState(true);
  const scrollPositions = useRef<Record<string, number>>({});

  // Heartbeat — updates last_active every 60s while app is open
  useHeartbeat();

  // Inactivity penalty check — runs once per day
  useInactivityCheck();

  // Auto-broadcast birthdays once per day (triggered by first admin to open the app)
  useEffect(() => {
    if (!dbUser?.is_admin) return;
    const today = new Date().toISOString().split("T")[0];
    const key = `birthday_broadcast_${today}`;
    if (localStorage.getItem(key)) return;

    const broadcastBirthdays = async () => {
      const { data: allUsers } = await supabase
        .from("users")
        .select("id, first_name, last_name, username, birthday, telegram_id")
        .not("birthday", "is", null);
      if (!allUsers) return;

      const todayMonth = new Date().getMonth() + 1;
      const todayDay = new Date().getDate();
      const birthdayUsers = allUsers.filter((u: any) => {
        const bday = new Date(u.birthday);
        return bday.getMonth() + 1 === todayMonth && bday.getDate() === todayDay;
      });

      if (birthdayUsers.length === 0) {
        localStorage.setItem(key, "no_birthdays");
        return;
      }

      // Get all users to notify
      const { data: recipients } = await supabase
        .from("users")
        .select("telegram_id")
        .neq("telegram_id", 0);

      if (!recipients) return;

      for (const bUser of birthdayUsers) {
        const name = [bUser.first_name, bUser.last_name].filter(Boolean).join(" ");
        const msg = `🎂 <b>Happy Birthday!</b>\n\nToday is <b>${name}</b>${bUser.username ? ` (@${bUser.username})` : ""}'s birthday!\n\nWish them a happy birthday with some Dreamers Coins! 🎉\n\nOpen the app to send them DR!`;
        for (const r of recipients) {
          if (r.telegram_id !== bUser.telegram_id) {
            notifyUser(r.telegram_id, msg);
          }
        }
      }

      localStorage.setItem(key, "sent");
    };

    broadcastBirthdays();
  }, [dbUser?.is_admin]);

  // Auto-calculate Weekly MVP (runs once per week when admin opens app)
  useEffect(() => {
    if (!dbUser?.is_admin) return;
    const today = new Date();
    const dayOfWeek = today.getDay();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - dayOfWeek);
    const weekStartStr = weekStart.toISOString().split("T")[0];
    const mvpKey = `mvp_calculated_${weekStartStr}`;
    if (localStorage.getItem(mvpKey)) return;

    const calculateMVP = async () => {
      // Check if MVP already exists for this week
      const { data: existing } = await supabase.from("weekly_mvps").select("id").eq("week_start", weekStartStr).maybeSingle();
      if (existing) { localStorage.setItem(mvpKey, "done"); return; }

      // Get all users' engagement
      const { data: users } = await supabase.from("users").select("id").eq("is_admin", false);
      if (!users || users.length === 0) return;

      let topUser = null;
      let topPoints = 0;
      for (const u of users) {
        const { count: mc } = await supabase.from("mission_completions").select("*", { count: "exact", head: true }).eq("user_id", u.id).eq("status", "approved");
        const { count: ac } = await supabase.from("activity_logs").select("*", { count: "exact", head: true }).eq("user_id", u.id);
        const { count: rc } = await supabase.from("raffle_entries").select("*", { count: "exact", head: true }).eq("user_id", u.id);
        const { count: cc } = await supabase.from("daily_checkins").select("*", { count: "exact", head: true }).eq("user_id", u.id);
        const points = ((mc ?? 0) * 3) + ((ac ?? 0) * 2) + (rc ?? 0) + (cc ?? 0);
        if (points > topPoints) { topPoints = points; topUser = u.id; }
      }

      if (topUser) {
        await supabase.from("weekly_mvps").insert({ user_id: topUser, week_start: weekStartStr, engagement_points: topPoints });
      }
      localStorage.setItem(mvpKey, "done");
    };

    calculateMVP();
  }, [dbUser?.is_admin]);

  // Auto-pair dreamers (runs once per week when any admin opens app)
  useEffect(() => {
    if (!dbUser?.is_admin) return;
    const today = new Date();
    const dayOfWeek = today.getDay();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - ((dayOfWeek + 6) % 7));
    const weekStartStr = weekStart.toISOString().split("T")[0];
    const pairKey = `pairs_created_${weekStartStr}`;
    if (localStorage.getItem(pairKey)) return;
    const runPairing = async () => {
      try {
        const { data } = await supabase.rpc("auto_pair_dreamers");
        if (data?.success) {
          localStorage.setItem(pairKey, "done");
        }
      } catch {}
    };
    runPairing();
  }, [dbUser?.is_admin]);

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
        : activeTab === "settings" ? "profile"
        : activeTab === "community" ? "home"
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
      case "settings":
        return <UserSettings />;
      case "community":
        return <Community />;
      case "states":
        return <States />;
      default:
        return <Home onTabChange={handleTabChange} />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>}>
        <AnimatePresence mode="wait">{renderCurrentPage()}</AnimatePresence>
      </Suspense>
      <BottomNav activeTab={activeTab} onTabChange={handleTabChange} notifications={0} />
    </div>
  );
};

export default Index;
