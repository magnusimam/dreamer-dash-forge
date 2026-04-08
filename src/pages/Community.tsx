import { useState } from "react";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useGiftWall, useCommunityStats, isUserOnline } from "@/hooks/useSupabase";
import { useUser } from "@/contexts/UserContext";
import UserProfileModal from "@/components/UserProfileModal";
import { Gift, Trophy, Target, Ticket, ClipboardList, Flame, Loader2, Crown, TrendingUp } from "lucide-react";

export default function Community() {
  const { dbUser } = useUser();
  const { data: giftWall = [], isLoading: giftsLoading } = useGiftWall();
  const { data: communityStats = [], isLoading: statsLoading } = useCommunityStats();
  const [viewProfileUserId, setViewProfileUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"gifts" | "stats">("gifts");

  const isLoading = giftsLoading || statsLoading;

  // Top 3 most engaged
  const topEngaged = communityStats.slice(0, 3);

  // Find current user stats
  const myStats = communityStats.find((u: any) => u.id === dbUser?.id);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pb-28 px-4 pt-6">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-4">
        <h1 className="text-2xl font-bold text-foreground mb-1">Community</h1>
        <p className="text-muted-foreground text-sm">See what Dreamers are doing</p>
      </motion.div>

      {/* My Stats Card */}
      {myStats && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="gradient-card border-primary/20 p-4 mb-4">
            <p className="text-xs text-muted-foreground mb-2">Your Activity</p>
            <div className="grid grid-cols-4 gap-2 text-center">
              <div>
                <p className="text-lg font-bold text-foreground">{myStats.activities}</p>
                <p className="text-[10px] text-muted-foreground">Activities</p>
              </div>
              <div>
                <p className="text-lg font-bold text-foreground">{myStats.missions}</p>
                <p className="text-[10px] text-muted-foreground">Missions</p>
              </div>
              <div>
                <p className="text-lg font-bold text-foreground">{myStats.raffles}</p>
                <p className="text-[10px] text-muted-foreground">Raffles</p>
              </div>
              <div>
                <p className="text-lg font-bold text-primary">{myStats.raffle_wins}</p>
                <p className="text-[10px] text-muted-foreground">Wins</p>
              </div>
            </div>
          </Card>
        </motion.div>
      )}

      {/* Toggle */}
      <div className="flex gap-2 mb-4">
        <Button size="sm" variant={activeTab === "gifts" ? "default" : "outline"} className={activeTab === "gifts" ? "bg-primary text-primary-foreground" : "border-border"} onClick={() => setActiveTab("gifts")}>
          <Gift className="w-3.5 h-3.5 mr-1.5" /> Gift Wall
        </Button>
        <Button size="sm" variant={activeTab === "stats" ? "default" : "outline"} className={activeTab === "stats" ? "bg-primary text-primary-foreground" : "border-border"} onClick={() => setActiveTab("stats")}>
          <TrendingUp className="w-3.5 h-3.5 mr-1.5" /> Engagement
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : activeTab === "gifts" ? (
        <>
          {/* Gift Wall */}
          {giftWall.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No gifts yet. Be the first to complete a mission!</p>
          ) : (
            <div className="space-y-3">
              {giftWall.map((gift: any) => (
                <motion.div key={gift.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                  <Card className="gradient-card border-border/50 p-3">
                    <div className="flex items-center gap-3">
                      <button className="relative shrink-0" onClick={() => setViewProfileUserId(gift.user_id)}>
                        <Avatar className="w-10 h-10">
                          <AvatarImage src={gift.user?.photo_url} />
                          <AvatarFallback className="bg-pink-500/20 text-pink-400 text-xs">
                            {[gift.user?.first_name?.[0], gift.user?.last_name?.[0]].filter(Boolean).join("")}
                          </AvatarFallback>
                        </Avatar>
                        <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-card ${isUserOnline(gift.user?.last_active) ? "bg-emerald-400" : "bg-muted-foreground/30"}`} />
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground">
                          <span className="font-medium">{gift.user?.first_name}</span> completed <span className="text-primary font-medium">{gift.mission?.title}</span>
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {new Date(gift.completed_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} at {new Date(gift.completed_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                      <Gift className="w-4 h-4 text-pink-400 shrink-0" />
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          {/* Top 3 Most Engaged */}
          {topEngaged.length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2"><Crown className="w-4 h-4 text-primary" /> Most Active Dreamers</h3>
              <div className="grid grid-cols-3 gap-2">
                {topEngaged.map((u: any, i: number) => (
                  <button key={u.id} className="text-center" onClick={() => setViewProfileUserId(u.id)}>
                    <Card className={`p-3 ${i === 0 ? "border-primary/30 bg-primary/5" : "gradient-card border-border/50"}`}>
                      <div className="relative mx-auto w-fit mb-1">
                        <Avatar className={`${i === 0 ? "w-12 h-12" : "w-10 h-10"}`}>
                          <AvatarImage src={u.photo_url} />
                          <AvatarFallback className="text-xs">{[u.first_name?.[0], u.last_name?.[0]].filter(Boolean).join("")}</AvatarFallback>
                        </Avatar>
                        <span className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-card ${isUserOnline(u.last_active) ? "bg-emerald-400" : "bg-muted-foreground/30"}`} />
                      </div>
                      <p className="text-xs font-medium text-foreground truncate">{u.first_name}</p>
                      <Badge className={`text-[9px] mt-1 ${i === 0 ? "bg-primary/20 text-primary border-primary/30" : "bg-secondary text-muted-foreground border-border"}`}>
                        #{i + 1}
                      </Badge>
                    </Card>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Full Engagement List */}
          <h3 className="text-sm font-semibold text-foreground mb-3">All Dreamers</h3>
          <div className="space-y-2">
            {communityStats.map((u: any, i: number) => {
              const isMe = u.id === dbUser?.id;
              return (
                <Card key={u.id} className={`border-border/50 p-3 ${isMe ? "border-primary/30 bg-primary/5" : "gradient-card"}`}>
                  <div className="flex items-center gap-3">
                    <span className="w-6 text-center text-xs font-bold text-muted-foreground">#{i + 1}</span>
                    <button className="relative shrink-0" onClick={() => setViewProfileUserId(u.id)}>
                      <Avatar className="w-9 h-9">
                        <AvatarImage src={u.photo_url} />
                        <AvatarFallback className="text-xs">{[u.first_name?.[0], u.last_name?.[0]].filter(Boolean).join("")}</AvatarFallback>
                      </Avatar>
                      <span className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-card ${isUserOnline(u.last_active) ? "bg-emerald-400" : "bg-muted-foreground/30"}`} />
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {[u.first_name, u.last_name].filter(Boolean).join(" ")}
                        {isMe && <span className="text-primary ml-1">(You)</span>}
                      </p>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-0.5"><ClipboardList className="w-2.5 h-2.5" />{u.activities}</span>
                        <span className="flex items-center gap-0.5"><Target className="w-2.5 h-2.5" />{u.missions}</span>
                        <span className="flex items-center gap-0.5"><Ticket className="w-2.5 h-2.5" />{u.raffles}</span>
                        {u.raffle_wins > 0 && <span className="flex items-center gap-0.5 text-primary"><Trophy className="w-2.5 h-2.5" />{u.raffle_wins}W</span>}
                        {u.streak > 0 && <span className="flex items-center gap-0.5"><Flame className="w-2.5 h-2.5 text-orange-400" />{u.streak}</span>}
                      </div>
                    </div>
                    <p className="text-xs font-bold text-primary">{u.engagement}pts</p>
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {viewProfileUserId && (
        <UserProfileModal userId={viewProfileUserId} onClose={() => setViewProfileUserId(null)} />
      )}
    </motion.div>
  );
}
