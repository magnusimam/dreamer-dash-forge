import { motion, AnimatePresence } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useUserProfile, isUserOnline } from "@/hooks/useSupabase";
import { X, Coins, Flame, Users, MapPin, CalendarDays, Send, Loader2, Award } from "lucide-react";

const achievementIcons: Record<string, string> = {
  star: "⭐", rocket: "🚀", crown: "👑", gem: "💎", flame: "🔥", heart: "❤️", shield: "🛡️",
};

interface UserProfileModalProps {
  userId: string | null;
  onClose: () => void;
  onTransfer?: (username: string) => void;
}

export default function UserProfileModal({ userId, onClose, onTransfer }: UserProfileModalProps) {
  const { data: profile, isLoading } = useUserProfile(userId);

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
                    {isUserOnline(profile.last_active) && <span className="text-[10px] text-emerald-400">Online</span>}
                  </div>
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
