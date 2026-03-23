import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Settings, BarChart3, Award, TrendingUp, Shield, Coins, Trophy, Copy,
  Star, Rocket, Crown, Gem, Flame, Users, Megaphone, Baby, CheckCircle,
  X, Lock,
  type LucideIcon,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTelegram } from "@/contexts/TelegramContext";
import { useUser } from "@/contexts/UserContext";
import { useAchievements, useUserAchievements, useCheckAchievements, useUserReferralCount, useReferredBy } from "@/hooks/useSupabase";

interface ProfileProps {
  onTabChange?: (tab: string) => void;
}

const iconMap: Record<string, LucideIcon> = {
  star: Star,
  rocket: Rocket,
  crown: Crown,
  gem: Gem,
  flame: Flame,
  users: Users,
  megaphone: Megaphone,
  baby: Baby,
};

export default function Profile({ onTabChange }: ProfileProps) {
  const { toast } = useToast();
  const { user } = useTelegram();
  const { dbUser } = useUser();
  const { data: achievements } = useAchievements();
  const { data: unlockedIds } = useUserAchievements();
  const checkAchievements = useCheckAchievements();
  const { data: referralCount } = useUserReferralCount();
  const { data: referredBy } = useReferredBy();
  const [selectedAchievement, setSelectedAchievement] = useState<any | null>(null);

  useEffect(() => {
    if (dbUser) {
      checkAchievements.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dbUser?.id]);

  const displayName = user
    ? [user.firstName, user.lastName].filter(Boolean).join(" ")
    : "Dreamer";
  const initials = user
    ? [user.firstName?.[0], user.lastName?.[0]].filter(Boolean).join("")
    : "DR";

  const balance = dbUser?.balance ?? 0;
  const totalEarned = dbUser?.total_earned ?? 0;
  const streak = dbUser?.streak ?? 0;
  const status = dbUser?.status ?? "Bronze";
  const isAdmin = dbUser?.is_admin ?? false;
  const memberSince = dbUser?.created_at
    ? new Date(dbUser.created_at).toLocaleDateString("en-NG", { month: "short", year: "numeric" })
    : "Recently";

  const tierColors: Record<string, string> = {
    Bronze: "bg-amber-700/20 text-amber-500 border-amber-700/30",
    Silver: "bg-gray-300/20 text-gray-300 border-gray-300/30",
    Gold: "bg-primary/20 text-primary border-primary/30",
    Diamond: "bg-cyan-400/20 text-cyan-400 border-cyan-400/30",
  };

  const tierThresholds = [
    { tier: "Silver", threshold: 5000 },
    { tier: "Gold", threshold: 20000 },
    { tier: "Diamond", threshold: 50000 },
  ];

  const nextTier = tierThresholds.find((t) => totalEarned < t.threshold);
  const progress = nextTier
    ? Math.round((totalEarned / nextTier.threshold) * 100)
    : 100;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="pb-28 px-4 pt-6"
    >
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <h1 className="text-2xl font-bold text-foreground mb-2">
          Profile
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
              <AvatarImage src={user?.photoUrl} />
              <AvatarFallback className="bg-primary text-primary-foreground text-xl">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div>
              <h2 className="text-xl font-bold text-foreground">{displayName}</h2>
              {user?.username && (
                <p className="text-sm text-muted-foreground">@{user.username}</p>
              )}
              <p className="text-muted-foreground">Member since {memberSince}</p>
              <div className="flex items-center gap-2 mt-2">
                <Badge className={tierColors[status] || tierColors.Bronze}>
                  <Award className="w-3 h-3 mr-1" />
                  {status}
                </Badge>
                {streak > 0 && (
                  <Badge variant="outline">
                    {streak} day streak 🔥
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {dbUser?.referral_code && (
            <div className="mt-4 pt-4 border-t border-border/50">
              <p className="text-xs text-muted-foreground mb-1">Your Referral Code</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-secondary/50 rounded px-3 py-1.5 text-sm font-mono text-foreground">
                  {dbUser.referral_code}
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2"
                  aria-label="Copy to clipboard"
                  onClick={() => {
                    navigator.clipboard.writeText(dbUser.referral_code!);
                    toast({ title: "Copied!", description: "Referral code copied to clipboard." });
                  }}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {referredBy && (
            <div className="mt-3 pt-3 border-t border-border/50">
              <p className="text-xs text-muted-foreground mb-1">Referred By</p>
              <p className="text-sm text-foreground font-medium">
                {[referredBy.first_name, referredBy.last_name].filter(Boolean).join(" ")}
                {referredBy.username && (
                  <span className="text-muted-foreground font-normal"> @{referredBy.username}</span>
                )}
              </p>
            </div>
          )}
        </Card>
      </motion.div>

      {/* Statistics */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="grid grid-cols-3 gap-3 mb-6"
      >
        <Card className="gradient-card border-border/50 p-4">
          <div className="text-center">
            <TrendingUp className="w-6 h-6 text-primary mx-auto mb-2" />
            <p className="text-2xl font-bold text-foreground">
              {totalEarned.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground">Total Earned</p>
          </div>
        </Card>

        <Card className="gradient-card border-border/50 p-4">
          <div className="text-center">
            <Coins className="w-6 h-6 text-primary mx-auto mb-2" />
            <p className="text-2xl font-bold text-foreground">
              {balance.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground">Balance</p>
          </div>
        </Card>

        <Card className="gradient-card border-border/50 p-4">
          <div className="text-center">
            <Users className="w-6 h-6 text-primary mx-auto mb-2" />
            <p className="text-2xl font-bold text-foreground">
              {referralCount ?? 0}
            </p>
            <p className="text-xs text-muted-foreground">Referrals</p>
          </div>
        </Card>
      </motion.div>

      {/* Tier Progress */}
      {nextTier && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="mb-6"
        >
          <Card className="gradient-card border-border/50 p-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-muted-foreground">Next tier: {nextTier.tier}</span>
              <span className="text-foreground font-medium">{totalEarned.toLocaleString()} / {nextTier.threshold.toLocaleString()} DR</span>
            </div>
            <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progress}%` }} />
            </div>
          </Card>
        </motion.div>
      )}

      {/* Achievements */}
      {achievements && achievements.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.28 }}
          className="mb-6"
        >
          <h3 className="text-lg font-semibold text-foreground mb-3">Achievements</h3>
          <div className="grid grid-cols-2 gap-3">
            {achievements.map((achievement: any) => {
              const unlocked = unlockedIds?.includes(achievement.id);
              const IconComponent = iconMap[achievement.icon] || Star;
              return (
                <Card
                  key={achievement.id}
                  className={`gradient-card border-border/50 p-3 relative cursor-pointer ${
                    unlocked ? "border-primary/40" : "opacity-60"
                  }`}
                  onClick={() => setSelectedAchievement(achievement)}
                >
                  {unlocked && (
                    <CheckCircle className="w-4 h-4 text-green-500 absolute top-2 right-2" />
                  )}
                  <IconComponent className="w-5 h-5 text-primary mb-1" />
                  <p className="text-sm font-medium text-foreground leading-tight">
                    {achievement.title}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                    {achievement.description}
                  </p>
                  <p className="text-xs text-primary mt-1 font-medium">
                    +{achievement.reward} DR
                  </p>
                </Card>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Action Buttons */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="space-y-3"
      >
        <Button
          onClick={() => onTabChange?.("leaderboard")}
          className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground shadow-glow"
        >
          <Trophy className="w-5 h-5 mr-2" />
          Leaderboard
        </Button>

        <Button
          variant="outline"
          className="w-full h-12 border-border hover:bg-muted"
          onClick={() => onTabChange?.("supply")}
        >
          <BarChart3 className="w-5 h-5 mr-2" />
          DR Supply Dashboard
        </Button>

        {isAdmin && (
          <Button
            variant="outline"
            className="w-full h-12 border-primary/30 text-primary hover:bg-primary/10"
            onClick={() => onTabChange?.("admin")}
          >
            <Shield className="w-5 h-5 mr-2" />
            Admin Panel
          </Button>
        )}
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

      {/* Achievement Detail Modal */}
      <AnimatePresence>
        {selectedAchievement && (() => {
          const isUnlocked = unlockedIds?.includes(selectedAchievement.id);
          const AchievementIcon = iconMap[selectedAchievement.icon] || Star;

          const conditionLabel = (() => {
            const ct = selectedAchievement.condition_type;
            const cv = selectedAchievement.condition_value;
            if (!ct || cv == null) return null;
            switch (ct) {
              case "total_earned":
                return `Earn ${Number(cv).toLocaleString()} DR total`;
              case "streak":
                return `Reach a ${cv}-day check-in streak`;
              case "referrals":
                return `Refer ${cv} friend${cv === 1 ? "" : "s"}`;
              case "activities":
                return `Complete ${cv} activit${cv === 1 ? "y" : "ies"}`;
              default:
                return `${ct.replace(/_/g, " ")}: ${cv}`;
            }
          })();

          return (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-end justify-center"
              onClick={() => setSelectedAchievement(null)}
            >
              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="w-full max-w-md bg-card border-t border-border rounded-t-2xl p-6 pb-16"
                onClick={(e) => e.stopPropagation()}
                drag="y"
                dragConstraints={{ top: 0 }}
                dragElastic={0.2}
                onDragEnd={(_, info) => {
                  if (info.offset.y > 100) {
                    setSelectedAchievement(null);
                  }
                }}
              >
                <div className="w-10 h-1 bg-border rounded-full mx-auto mb-4" />
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-foreground text-lg">
                    Achievement Details
                  </h3>
                  <button
                    onClick={() => setSelectedAchievement(null)}
                    className="p-1 rounded-full hover:bg-muted"
                  >
                    <X className="w-5 h-5 text-muted-foreground" />
                  </button>
                </div>

                <div className="flex flex-col items-center text-center gap-3">
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center ${isUnlocked ? "bg-primary/20" : "bg-muted"}`}>
                    <AchievementIcon className={`w-8 h-8 ${isUnlocked ? "text-primary" : "text-muted-foreground"}`} />
                  </div>

                  <h4 className="text-lg font-bold text-foreground">
                    {selectedAchievement.title}
                  </h4>

                  <p className="text-sm text-muted-foreground">
                    {selectedAchievement.description}
                  </p>

                  <Badge className="bg-primary/20 text-primary border-primary/30 text-sm">
                    +{selectedAchievement.reward} DR
                  </Badge>

                  {isUnlocked ? (
                    <div className="flex items-center gap-2 text-green-500">
                      <CheckCircle className="w-5 h-5" />
                      <span className="text-sm font-medium">Unlocked</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Lock className="w-5 h-5" />
                        <span className="text-sm font-medium">Locked</span>
                      </div>
                      {conditionLabel && (
                        <p className="text-xs text-muted-foreground/80 mt-1">
                          {conditionLabel}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>
    </motion.div>
  );
}
