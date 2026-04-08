import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useUserProfile, isUserOnline, useCommunityStats, getDreamerLevel } from "@/hooks/useSupabase";
import { X, Coins, Flame, Users, MapPin, CalendarDays, Send, Loader2, Award, Eye, EyeOff, Copy, Check } from "lucide-react";

const achievementIcons: Record<string, string> = {
  star: "⭐", rocket: "🚀", crown: "👑", gem: "💎", flame: "🔥", heart: "❤️", shield: "🛡️",
};

function BankDetailsToggle({ bankName, accountNumber, accountName }: { bankName: string; accountNumber: string; accountName: string }) {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(`${accountName}\n${bankName}\n${accountNumber}`);
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
      setVisible(false);
    }, 1500);
  };

  return (
    <div className="mb-4 bg-secondary/50 rounded-lg p-3">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-medium text-muted-foreground">Bank Details</p>
        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-muted-foreground" onClick={() => setVisible(!visible)}>
          {visible ? <EyeOff className="w-3 h-3 mr-1" /> : <Eye className="w-3 h-3 mr-1" />}
          {visible ? "Hide" : "Show"}
        </Button>
      </div>
      {visible ? (
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-foreground font-medium">{accountName}</p>
            <p className="text-xs text-muted-foreground">{bankName} — {accountNumber}</p>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={handleCopy}>
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </Button>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Tap "Show" to view bank details</p>
      )}
    </div>
  );
}

interface UserProfileModalProps {
  userId: string | null;
  onClose: () => void;
  onTransfer?: (username: string) => void;
}

export default function UserProfileModal({ userId, onClose, onTransfer }: UserProfileModalProps) {
  const { data: profile, isLoading } = useUserProfile(userId);
  const { data: communityStats = [] } = useCommunityStats();
  const userEngagement = communityStats.find((u: any) => u.id === userId);
  const userLevel = userEngagement ? getDreamerLevel(userEngagement.engagement) : null;

  if (!userId) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-end justify-center"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="w-full max-w-md bg-card border-t border-border rounded-t-2xl p-6 pb-16"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-10 h-1 bg-border rounded-full mx-auto mb-4" />

          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : !profile ? (
            <p className="text-sm text-muted-foreground text-center py-8">User not found</p>
          ) : (
            <>
              {/* Header */}
              <div className="flex items-center gap-4 mb-4">
                <div className="relative">
                  <Avatar className="w-16 h-16">
                    <AvatarImage src={profile.photo_url} />
                    <AvatarFallback className="bg-primary/20 text-primary text-xl">
                      {[profile.first_name?.[0], profile.last_name?.[0]].filter(Boolean).join("")}
                    </AvatarFallback>
                  </Avatar>
                  <span className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-card ${isUserOnline(profile.last_active) ? "bg-emerald-400" : "bg-muted-foreground/30"}`} />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-foreground">
                    {[profile.first_name, profile.last_name].filter(Boolean).join(" ")}
                  </h3>
                  {profile.username && <p className="text-sm text-muted-foreground">@{profile.username}</p>}
                  <div className="flex items-center gap-2 mt-1">
                    <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px]">{profile.status}</Badge>
                    {userLevel && <Badge variant="outline" className="text-[10px]">Lv.{userLevel.level} {userLevel.title}</Badge>}
                    {isUserOnline(profile.last_active) && <span className="text-[10px] text-emerald-400">Online</span>}
                  </div>
                  {userLevel && (
                    <div className="mt-1.5">
                      <div className="w-full h-1 bg-secondary rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${userLevel.progress}%` }} />
                      </div>
                      <p className="text-[9px] text-muted-foreground mt-0.5">{userLevel.currentXP} / {userLevel.nextXP} XP</p>
                    </div>
                  )}
                </div>
                <Button size="icon" variant="ghost" className="self-start" onClick={onClose}>
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                <Card className="bg-secondary/50 border-border/50 p-3 text-center">
                  <Coins className="w-4 h-4 text-primary mx-auto mb-1" />
                  <p className="text-sm font-bold text-foreground">{profile.balance.toLocaleString()}</p>
                  <p className="text-[10px] text-muted-foreground">Balance</p>
                </Card>
                <Card className="bg-secondary/50 border-border/50 p-3 text-center">
                  <Flame className="w-4 h-4 text-orange-400 mx-auto mb-1" />
                  <p className="text-sm font-bold text-foreground">{profile.streak}</p>
                  <p className="text-[10px] text-muted-foreground">Streak</p>
                </Card>
                <Card className="bg-secondary/50 border-border/50 p-3 text-center">
                  <Users className="w-4 h-4 text-purple-400 mx-auto mb-1" />
                  <p className="text-sm font-bold text-foreground">{profile.referral_count}</p>
                  <p className="text-[10px] text-muted-foreground">Referrals</p>
                </Card>
              </div>

              {/* Info */}
              <div className="space-y-2 mb-4">
                {profile.state_name && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <MapPin className="w-3 h-3" /> {profile.state_name}
                  </div>
                )}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CalendarDays className="w-3 h-3" /> Joined {new Date(profile.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                </div>
                {profile.birthday && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    🎂 Birthday: {new Date(profile.birthday).toLocaleDateString("en-GB", { day: "numeric", month: "long" })}
                  </div>
                )}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Coins className="w-3 h-3 text-primary" /> Total earned: {profile.total_earned.toLocaleString()} DR
                </div>
              </div>

              {/* Bank Details */}
              {profile.bank_name && profile.account_number && (
                <BankDetailsToggle
                  bankName={profile.bank_name}
                  accountNumber={profile.account_number}
                  accountName={profile.account_name}
                />
              )}

              {/* Achievements */}
              {profile.achievements.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1"><Award className="w-3 h-3" /> Achievements</p>
                  <div className="flex flex-wrap gap-1.5">
                    {profile.achievements.map((a: any) => (
                      <Badge key={a.id} variant="outline" className="text-[10px] gap-1">
                        {achievementIcons[a.achievement?.icon] || "🏅"} {a.achievement?.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Send DR button */}
              {onTransfer && profile.username && (
                <Button
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-glow"
                  onClick={() => {
                    onClose();
                    onTransfer(profile.username);
                  }}
                >
                  <Send className="w-4 h-4 mr-2" /> Send DR to {profile.first_name}
                </Button>
              )}
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
