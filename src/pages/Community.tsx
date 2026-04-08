import { useState } from "react";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useGiftWall, useCommunityStats, isUserOnline } from "@/hooks/useSupabase";
import { useUser } from "@/contexts/UserContext";
import UserProfileModal from "@/components/UserProfileModal";
import { Gift, Trophy, Target, Ticket, ClipboardList, Flame, Loader2, Crown, TrendingUp, CheckCircle, Send, BookOpen, Rocket } from "lucide-react";

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
            <p className="text-xs text-muted-foreground mb-2">Your Activity — {myStats.engagement} pts</p>
            <div className="grid grid-cols-4 gap-2 text-center mb-2">
              <div>
                <p className="text-lg font-bold text-foreground">{myStats.checkins}</p>
                <p className="text-[10px] text-muted-foreground">Check-ins</p>
              </div>
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
            </div>
            <div className="grid grid-cols-5 gap-2 text-center">
              <div>
                <p className="text-lg font-bold text-primary">{myStats.raffle_wins}</p>
                <p className="text-[10px] text-muted-foreground">Wins</p>
              </div>
              <div>
                <p className="text-lg font-bold text-foreground">{myStats.hackathons}</p>
                <p className="text-[10px] text-muted-foreground">Hacks</p>
              </div>
              <div>
                <p className="text-lg font-bold text-foreground">{myStats.promos}</p>
                <p className="text-[10px] text-muted-foreground">Promos</p>
              </div>
              <div>
                <p className="text-lg font-bold text-foreground">{myStats.transfers}</p>
                <p className="text-[10px] text-muted-foreground">Transfers</p>
              </div>
              <div>
                <p className="text-lg font-bold text-foreground">{myStats.redeems}</p>
                <p className="text-[10px] text-muted-foreground">Redeems</p>
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
            <p className="text-sm text-muted-foreground text-center py-8">No activity yet. Be the first!</p>
          ) : (
            <div className="space-y-2">
              {giftWall.map((item: any) => {
                const iconMap: Record<string, any> = { mission: Target, promo: BookOpen, transfer: Send };
                const colorMap: Record<string, string> = { mission: "text-pink-400 bg-pink-500/20", promo: "text-purple-400 bg-purple-500/20", transfer: "text-blue-400 bg-blue-500/20" };
                const Icon = iconMap[item.type] || Gift;
                const color = colorMap[item.type] || "text-primary bg-primary/20";

                let description = "";
                if (item.type === "mission") description = `completed ${item.title}`;
                else if (item.type === "promo") description = `claimed ${item.title}`;
                else if (item.type === "transfer") description = item.title;

                return (
                  <motion.div key={item.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                    <Card className="gradient-card border-border/50 p-3">
                      <div className="flex items-center gap-3">
                        <button className="relative shrink-0" onClick={() => setViewProfileUserId(item.user_id)}>
                          <Avatar className="w-9 h-9">
                            <AvatarImage src={item.user?.photo_url} />
                            <AvatarFallback className="text-xs">
                              {[item.user?.first_name?.[0], item.user?.last_name?.[0]].filter(Boolean).join("")}
                            </AvatarFallback>
                          </Avatar>
                          <span className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-card ${isUserOnline(item.user?.last_active) ? "bg-emerald-400" : "bg-muted-foreground/30"}`} />
                        </button>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-foreground">
                            <span className="font-medium">{item.user?.first_name}</span> {description}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {new Date(item.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} at {new Date(item.date).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${color.split(" ")[1]}`}>
                          <Icon className={`w-3.5 h-3.5 ${color.split(" ")[0]}`} />
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                );
              })}
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
                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-0.5" title="Check-ins"><CheckCircle className="w-2.5 h-2.5" />{u.checkins}</span>
                        <span className="flex items-center gap-0.5" title="Activities"><ClipboardList className="w-2.5 h-2.5" />{u.activities}</span>
                        <span className="flex items-center gap-0.5" title="Missions"><Target className="w-2.5 h-2.5" />{u.missions}</span>
                        <span className="flex items-center gap-0.5" title="Raffles"><Ticket className="w-2.5 h-2.5" />{u.raffles}</span>
                        {u.raffle_wins > 0 && <span className="flex items-center gap-0.5 text-primary" title="Raffle wins"><Trophy className="w-2.5 h-2.5" />{u.raffle_wins}</span>}
                        {u.hackathons > 0 && <span className="flex items-center gap-0.5" title="Hackathons"><Rocket className="w-2.5 h-2.5" />{u.hackathons}</span>}
                        {u.promos > 0 && <span className="flex items-center gap-0.5 text-purple-400" title="Promos"><BookOpen className="w-2.5 h-2.5" />{u.promos}</span>}
                        {u.transfers > 0 && <span className="flex items-center gap-0.5" title="Transfers"><Send className="w-2.5 h-2.5" />{u.transfers}</span>}
                        {u.streak > 0 && <span className="flex items-center gap-0.5" title="Streak"><Flame className="w-2.5 h-2.5 text-orange-400" />{u.streak}</span>}
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
