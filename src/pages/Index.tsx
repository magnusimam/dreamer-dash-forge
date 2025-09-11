import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import BottomNav from "@/components/BottomNav";
import Home from "@/pages/Home";
import Missions from "@/pages/Missions";
import Redeem from "@/pages/Redeem";
import Transactions from "@/pages/Transactions";
import Profile from "@/pages/Profile";

const Index = () => {
  const [activeTab, setActiveTab] = useState("home");
  const [balance, setBalance] = useState(2450);

  const handleUpdateBalance = (amount: number) => {
    setBalance(prev => prev + amount);
  };

  const renderCurrentPage = () => {
    switch (activeTab) {
      case "home":
        return <Home balance={balance} onTabChange={setActiveTab} />;
      case "missions":
        return <Missions onUpdateBalance={handleUpdateBalance} />;
      case "redeem":
        return <Redeem balance={balance} onUpdateBalance={handleUpdateBalance} />;
      case "transactions":
        return <Transactions />;
      case "profile":
        return <Profile balance={balance} />;
      default:
        return <Home balance={balance} onTabChange={setActiveTab} />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <AnimatePresence mode="wait">
        {renderCurrentPage()}
      </AnimatePresence>
      
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
};

export default Index;
