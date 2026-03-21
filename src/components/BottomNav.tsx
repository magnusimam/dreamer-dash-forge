import { Home, ClipboardList, Rocket, Gift, User } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { hapticSelection } from "@/lib/telegram";

interface BottomNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  notifications?: number;
}

const navItems = [
  { id: "home", icon: Home, label: "Home" },
  { id: "activities", icon: ClipboardList, label: "Log" },
  { id: "hackathons", icon: Rocket, label: "Hacks" },
  { id: "redeem", icon: Gift, label: "Redeem" },
  { id: "profile", icon: User, label: "Profile" },
];

export default function BottomNav({ activeTab, onTabChange, notifications }: BottomNavProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-card/80 backdrop-blur-lg border-t border-border z-50">
      <div className="flex items-center justify-around py-2 px-4 max-w-md mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <motion.button
              key={item.id}
              onClick={() => {
                hapticSelection();
                onTabChange(item.id);
              }}
              className={cn(
                "flex flex-col items-center p-2 rounded-lg transition-smooth relative",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
              whileTap={{ scale: 0.95 }}
            >
              {isActive && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute inset-0 bg-primary/10 rounded-lg"
                  initial={false}
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}
              {item.id === "home" && notifications && notifications > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-destructive rounded-full" />
              )}
              <Icon className="w-5 h-5 mb-1 relative z-10" />
              <span className="text-xs font-medium relative z-10">
                {item.label}
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
