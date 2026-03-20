import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import BottomNav from "@/components/BottomNav";
import Home from "@/pages/Home";
import ActivityLog from "@/pages/ActivityLog";
import Hackathons from "@/pages/Hackathons";
import Redeem from "@/pages/Redeem";
import Profile from "@/pages/Profile";
import Admin from "@/pages/Admin";

const Index = () => {
  const [activeTab, setActiveTab] = useState("home");
  const [balance, setBalance] = useState(2450);

  const handleUpdateBalance = (amount: number) => {
    setBalance((prev) => prev + amount);
  };

  const renderCurrentPage = () => {
    switch (activeTab) {
      case "home":
        return <Home balance={balance} onTabChange={setActiveTab} />;
      case "activities":
        return <ActivityLog onUpdateBalance={handleUpdateBalance} />;
      case "hackathons":
        return (
          <Hackathons
            balance={balance}
            onUpdateBalance={handleUpdateBalance}
          />
        );
      case "redeem":
        return (
          <Redeem balance={balance} onUpdateBalance={handleUpdateBalance} />
        );
      case "profile":
        return <Profile balance={balance} onTabChange={setActiveTab} />;
      case "admin":
        return <Admin />;
      default:
        return <Home balance={balance} onTabChange={setActiveTab} />;
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
