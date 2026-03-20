import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Settings, User, Award, TrendingUp, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ProfileProps {
  balance: number;
  onTabChange?: (tab: string) => void;
}

export default function Profile({ balance, onTabChange }: ProfileProps) {
  const { toast } = useToast();
  
  const userStats = {
    totalEarned: 15420,
    missionsCompleted: 47,
    redeemed: 8500,
    streak: 12,
  };

  const handleTransfer = () => {
    toast({
      title: "Coming Soon! 🚀",
      description: "Transfer feature will be available in the next update.",
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="pb-20 px-4 pt-6"
    >
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <h1 className="text-2xl font-bold text-foreground mb-2">
          Profile 👤
        </h1>
        <p className="text-muted-foreground">
          Manage your account and view statistics
        </p>
      </motion.div>

      {/* User Info Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="gradient-card border-border/50 p-6 mb-6">
          <div className="flex items-center gap-4 mb-4">
            <Avatar className="w-16 h-16">
              <AvatarImage src="/placeholder-avatar.png" />
              <AvatarFallback className="bg-primary text-primary-foreground text-xl">
                MI
              </AvatarFallback>
            </Avatar>
            <div>
              <h2 className="text-xl font-bold text-foreground">Magnus Imam</h2>
              <p className="text-muted-foreground">Member since Jan 2024</p>
              <div className="flex items-center gap-2 mt-2">
                <Badge className="bg-primary/20 text-primary border-primary/30">
                  <Award className="w-3 h-3 mr-1" />
                  Gold Status
                </Badge>
                <Badge variant="outline">
                  {userStats.streak} day streak 🔥
                </Badge>
              </div>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Statistics */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="grid grid-cols-2 gap-3 mb-6"
      >
        <Card className="gradient-card border-border/50 p-4">
          <div className="text-center">
            <TrendingUp className="w-6 h-6 text-primary mx-auto mb-2" />
            <p className="text-2xl font-bold text-foreground">
              {userStats.totalEarned.toLocaleString()}
            </p>
            <p className="text-sm text-muted-foreground">Total Earned</p>
          </div>
        </Card>
        
        <Card className="gradient-card border-border/50 p-4">
          <div className="text-center">
            <Award className="w-6 h-6 text-primary mx-auto mb-2" />
            <p className="text-2xl font-bold text-foreground">
              {userStats.missionsCompleted}
            </p>
            <p className="text-sm text-muted-foreground">Missions Done</p>
          </div>
        </Card>
      </motion.div>

      {/* Action Buttons */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="space-y-3"
      >
        <Button
          onClick={handleTransfer}
          className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground shadow-glow"
        >
          <User className="w-5 h-5 mr-2" />
          Transfer DR
        </Button>
        
        <Button
          variant="outline"
          className="w-full h-12 border-border hover:bg-muted"
        >
          <Settings className="w-5 h-5 mr-2" />
          Settings
        </Button>

        <Button
          variant="outline"
          className="w-full h-12 border-primary/30 text-primary hover:bg-primary/10"
          onClick={() => onTabChange?.("admin")}
        >
          <Shield className="w-5 h-5 mr-2" />
          Admin Panel
        </Button>
      </motion.div>

      {/* App Info */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="mt-8 text-center"
      >
        <p className="text-sm text-muted-foreground mb-2">
          Dreamers Coin v1.0.0
        </p>
        <p className="text-xs text-muted-foreground">
          Made with ❤️ for the Dreamers community
        </p>
      </motion.div>
    </motion.div>
  );
}