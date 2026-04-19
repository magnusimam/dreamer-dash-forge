import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useGiftWall, useCommunityStats, useCommunityMilestones, useWeeklyMVP, useLiveTicker, isUserOnline, getDreamerLevel, useContributionLeaderboard } from "@/hooks/useSupabase";
import { useUser } from "@/contexts/UserContext";
import UserProfileModal from "@/components/UserProfileModal";
import { Gift, Trophy, Target, Ticket, ClipboardList, Flame, Loader2, Crown, TrendingUp, CheckCircle, Send, BookOpen, Rocket, Users, Zap, Heart } from "lucide-react";

function LiveTicker({ items }: { items: { text: string; id: string }[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let pos = 0;
    const speed = 0.5;
    const animate = () => {
      pos += speed;
      if (pos >= el.scrollWidth / 2) pos = 0;
      el.scrollLeft = pos;
      requestAnimationFrame(animate);
    };
    const id = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(id);
  }, [items]);

  if (items.length === 0) return null;
  const doubled = [...items, ...items];

  return (
    <div ref={scrollRef} className="overflow-hidden whitespace-nowrap mb-4 bg-secondary/50 rounded-lg py-2 px-1">
      <div className="inline-flex gap-6">
        {doubled.map((item, i) => (
          <span key={i} className="text-xs text-muted-foreground inline-flex items-center gap-1">
            <Zap className="w-3 h-3 text-primary shrink-0" /> {item.text}
          </span>
        ))}
      </div>
    </div>
  );
}

function MilestoneBar({ label, current, target, icon: Icon }: { label: string; current: number; target: number; icon: any }) {
  const percent = Math.min((current / target) * 100, 100);
  return (
    <div className="flex items-center gap-2">
      <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
      <div className="flex-1">
        <div className="flex justify-between text-[10px] mb-0.5">
          <span className="text-muted-foreground">{label}</span>
          <span className="text-foreground font-medium">{current}/{target}</span>
        </div>
        <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${percent}%` }} />
        </div>
      </div>
    </div>
  );
}

export default function Community() {
  const { dbUser } = useUser();
  const { data: giftWall = [], isLoading: giftsLoading } = useGiftWall();
  const { data: communityStats = [], isLoading: statsLoading } = useCommunityStats();
  const { data: milestones } = useCommunityMilestones();
  const { data: mvpData } = useWeeklyMVP();
  const { data: tickerItems = [] } = useLiveTicker();
  const { data: contributionLB = [] } = useContributionLeaderboard();
  const [viewProfileUserId, setViewProfileUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"gifts" | "stats" | "givers">("gifts");

  const isLoading = giftsLoading || statsLoading;
  const topEngaged = communityStats.slice(0, 3);
  const myStats = communityStats.find((u: any) => u.id === dbUser?.id);
  const myLevel = myStats ? getDreamerLevel(myStats.engagement) : null;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pb-28 px-4 pt-6">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-4">
        <h1 className="text-2xl font-bold text-foreground mb-1">Community</h1>
        <p className="text-muted-foreground text-sm">See what Dreamers are doing</p>
      </motion.div>

      {/* Weekly MVP */}
      {mvpData?.current && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Card className="border-primary/30 bg-gradient-to-r from-primary/10 to-yellow-500/10 p-4 mb-4">
            <div className="flex items-center gap-3">
              <Crown className="w-6 h-6 text-yellow-400 shrink-0" />
              <button className="relative shrink-0" onClick={() => setViewProfileUserId(mvpData.current.user_id)}>
                <Avatar className="w-12 h-12 border-2 border-yellow-400">
                  <AvatarImage src={mvpData.current.user?.photo_url} />
                  <AvatarFallback>{mvpData.current.user?.first_name?.[0]}</AvatarFallback>
                </Avatar>
                <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-card ${isUserOnline(mvpData.current.user?.last_active) ? "bg-emerald-400" : "bg-muted-foreground/30"}`} />
              </button>
              <div className="flex-1">
                <p className="text-[10px] text-yellow-400 font-medium uppercase tracking-wider">Weekly MVP</p>
                <p className="text-sm font-bold text-foreground">{mvpData.current.user?.first_name} {mvpData.current.user?.last_name || ""}</p>
                <p className="text-xs text-muted-foreground">{mvpData.current.engagement_points} engagement pts</p>
              </div>
            </div>
            {mvpData.history.length > 0 && (
              <div className="mt-3 pt-2 border-t border-border/30">
                <p className="text-[10px] text-muted-foreground mb-1">Hall of Fame</p>
                <div className="flex gap-2">
                  {mvpData.history.map((m: any) => (
                    <button key={m.id} className="relative" onClick={() => setViewProfileUserId(m.user_id)}>
                      <Avatar className="w-7 h-7">
                        <AvatarImage src={m.user?.photo_url} />
                        <AvatarFallback className="text-[10px]">{m.user?.first_name?.[0]}</AvatarFallback>
                      </Avatar>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </motion.div>
      )}

      {/* Live Ticker */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
        <LiveTicker items={tickerItems} />
      </motion.div>

      {/* Community Milestones */}
      {milestones && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card className="gradient-card border-border/50 p-4 mb-4">
            <p className="text-xs font-semibold text-foreground mb-3 flex items-center gap-1.5"><Target className="w-3.5 h-3.5 text-primary" /> Community Milestones</p>
            <div className="space-y-2.5">
              <MilestoneBar label="Users" current={milestones.users.current} target={milestones.users.target} icon={Users} />
              <MilestoneBar label="Check-ins" current={milestones.checkins.current} target={milestones.checkins.target} icon={CheckCircle} />
              <MilestoneBar label="Activities" current={milestones.activities.current} target={milestones.activities.target} icon={ClipboardList} />
              <MilestoneBar label="Transfers" current={milestones.transfers.current} target={milestones.transfers.target} icon={Send} />
              <MilestoneBar label="Missions" current={milestones.missions.current} target={milestones.missions.target} icon={Target} />
              <MilestoneBar label="Raffle Entries" current={milestones.raffles.current} target={milestones.raffles.target} icon={Ticket} />
            </div>
          </Card>
        </motion.div>
      )}

      {/* My Stats */}
      {myStats && myLevel && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="gradient-card border-primary/20 p-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-muted-foreground">Your Activity</p>
              <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px]">Lv.{myLevel.level} {myLevel.title}</Badge>
            </div>
            <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden mb-3">
              <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${myLevel.progress}%` }} />
            </div>
            <p className="text-[10px] text-muted-foreground mb-2">{myStats.engagement} / {myLevel.nextXP} XP to Level {myLevel.level + 1}</p>
            <div className="grid grid-cols-4 gap-2 text-center mb-2">
              <div><p className="text-lg font-bold text-foreground">{myStats.checkins}</p><p className="text-[10px] text-muted-foreground">Check-ins</p></div>
              <div><p className="text-lg font-bold text-foreground">{myStats.activities}</p><p className="text-[10px] text-muted-foreground">Activities</p></div>
              <div><p className="text-lg font-bold text-foreground">{myStats.missions}</p><p className="text-[10px] text-muted-foreground">Missions</p></div>
              <div><p className="text-lg font-bold text-foreground">{myStats.raffles}</p><p className="text-[10px] text-muted-foreground">Raffles</p></div>
            </div>
            <div className="grid grid-cols-5 gap-2 text-center">
              <div><p className="text-lg font-bold text-primary">{myStats.raffle_wins}</p><p className="text-[10px] text-muted-foreground">Wins</p></div>
              <div><p className="text-lg font-bold text-foreground">{myStats.hackathons}</p><p className="text-[10px] text-muted-foreground">Hacks</p></div>
              <div><p className="text-lg font-bold text-foreground">{myStats.promos}</p><p className="text-[10px] text-muted-foreground">Promos</p></div>
              <div><p className="text-lg font-bold text-foreground">{myStats.transfers}</p><p className="text-[10px] text-muted-foreground">Transfers</p></div>
              <div><p className="text-lg font-bold text-foreground">{myStats.redeems}</p><p className="text-[10px] text-muted-foreground">Redeems</p></div>
            </div>
          </Card>
        </motion.div>
      )}

      {/* Toggle */}
      <div className="flex gap-2 mb-4 overflow-x-auto scrollbar-hide -mx-4 px-4">
        <Button size="sm" variant={activeTab === "gifts" ? "default" : "outline"} className={`${activeTab === "gifts" ? "bg-primary text-primary-foreground" : "border-border"} shrink-0`} onClick={() => setActiveTab("gifts")}>
          <Gift className="w-3.5 h-3.5 mr-1.5" /> Feed
        </Button>
        <Button size="sm" variant={activeTab === "stats" ? "default" : "outline"} className={`${activeTab === "stats" ? "bg-primary text-primary-foreground" : "border-border"} shrink-0`} onClick={() => setActiveTab("stats")}>
          <TrendingUp className="w-3.5 h-3.5 mr-1.5" /> Engagement
        </Button>
        <Button size="sm" variant={activeTab === "givers" ? "default" : "outline"} className={`${activeTab === "givers" ? "bg-primary text-primary-foreground" : "border-border"} shrink-0`} onClick={() => setActiveTab("givers")}>
          <Heart className="w-3.5 h-3.5 mr-1.5" /> Givers
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : activeTab === "gifts" ? (
        <>
          {giftWall.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No activity yet. Be the first!</p>
          ) : (
            <div className="space-y-2">
              {giftWall.map((item: any) => {
                const iconMap: Record<string, any> = { mission: Target, promo: BookOpen, transfer: Send, magicbox: Gift };
                const colorMap: Record<string, string> = { mission: "text-pink-400 bg-pink-500/20", promo: "text-purple-400 bg-purple-500/20", transfer: "text-blue-400 bg-blue-500/20", magicbox: "text-yellow-400 bg-yellow-500/20" };
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
      ) : activeTab === "stats" ? (
        <>
          {/* Top 3 Most Engaged */}
          {topEngaged.length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2"><Crown className="w-4 h-4 text-primary" /> Most Active Dreamers</h3>
              <div className="grid grid-cols-3 gap-2">
                {topEngaged.map((u: any, i: number) => {
                  const lvl = getDreamerLevel(u.engagement);
                  return (
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
                        <p className="text-[10px] text-primary">Lv.{lvl.level}</p>
                        <Badge className={`text-[9px] mt-0.5 ${i === 0 ? "bg-primary/20 text-primary border-primary/30" : "bg-secondary text-muted-foreground border-border"}`}>
                          #{i + 1}
                        </Badge>
                      </Card>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Full Engagement List */}
          <h3 className="text-sm font-semibold text-foreground mb-3">All Dreamers</h3>
          <div className="space-y-2">
            {communityStats.map((u: any, i: number) => {
              const isMe = u.id === dbUser?.id;
              const lvl = getDreamerLevel(u.engagement);
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
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-medium text-foreground truncate">
                          {[u.first_name, u.last_name].filter(Boolean).join(" ")}
                          {isMe && <span className="text-primary ml-1">(You)</span>}
                        </p>
                        <Badge className="bg-primary/15 text-primary border-primary/20 text-[9px] shrink-0">Lv.{lvl.level}</Badge>
                      </div>
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
                    <p className="text-xs font-bold text-primary shrink-0">{u.engagement}pts</p>
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      ) : null}

      {activeTab === "givers" && (
        <>
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2"><Heart className="w-4 h-4 text-green-400" /> Community Support</h3>

          {/* Users who have contributed — ranked by amount */}
          {contributionLB.length > 0 && (
            <div className="space-y-2 mb-4">
              {contributionLB.map((entry: any, i: number) => (
                <Card key={entry.user_id} className={`border-border/50 p-3 ${i === 0 ? "border-green-500/30 bg-green-500/5" : "gradient-card"}`}>
                  <div className="flex items-center gap-3">
                    <span className="w-6 text-center text-xs font-bold text-muted-foreground">#{i + 1}</span>
                    <button className="relative shrink-0" onClick={() => setViewProfileUserId(entry.user_id)}>
                      <Avatar className="w-9 h-9">
                        <AvatarImage src={entry.user?.photo_url} />
                        <AvatarFallback className="text-xs">{[entry.user?.first_name?.[0], entry.user?.last_name?.[0]].filter(Boolean).join("")}</AvatarFallback>
                      </Avatar>
                      <span className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-card ${isUserOnline(entry.user?.last_active) ? "bg-emerald-400" : "bg-muted-foreground/30"}`} />
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{[entry.user?.first_name, entry.user?.last_name].filter(Boolean).join(" ")}</p>
                      <p className="text-[10px] text-muted-foreground">{entry.count} contribution{entry.count !== 1 ? "s" : ""}</p>
                    </div>
                    <p className="text-sm font-bold text-green-400">₦{entry.amount.toLocaleString()}</p>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* All other users who haven't contributed */}
          {communityStats.filter((u: any) => !contributionLB.find((c: any) => c.user_id === u.id)).length > 0 && (
            <div className="space-y-2">
              {contributionLB.length > 0 && <p className="text-xs text-muted-foreground mb-2">Not yet contributed</p>}
              {communityStats.filter((u: any) => !contributionLB.find((c: any) => c.user_id === u.id)).map((u: any) => (
                <Card key={u.id} className="gradient-card border-border/50 p-3 opacity-60">
                  <div className="flex items-center gap-3">
                    <span className="w-6 text-center text-xs font-bold text-muted-foreground">—</span>
                    <button className="relative shrink-0" onClick={() => setViewProfileUserId(u.id)}>
                      <Avatar className="w-9 h-9">
                        <AvatarImage src={u.photo_url} />
                        <AvatarFallback className="text-xs">{[u.first_name?.[0], u.last_name?.[0]].filter(Boolean).join("")}</AvatarFallback>
                      </Avatar>
                      <span className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-card ${isUserOnline(u.last_active) ? "bg-emerald-400" : "bg-muted-foreground/30"}`} />
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{[u.first_name, u.last_name].filter(Boolean).join(" ")}</p>
                      <p className="text-[10px] text-muted-foreground">0 contributions</p>
                    </div>
                    <p className="text-sm font-bold text-muted-foreground">₦0</p>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {viewProfileUserId && (
        <UserProfileModal userId={viewProfileUserId} onClose={() => setViewProfileUserId(null)} />
      )}
    </motion.div>
  );
}
