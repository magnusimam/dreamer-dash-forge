import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  useHackathons,
  useUserHackathonRegistrations,
  useRegisterHackathon,
} from "@/hooks/useSupabase";
import { useUser } from "@/contexts/UserContext";
import {
  CalendarDays,
  Users,
  Trophy,
  Coins,
  Rocket,
  CheckCircle,
  X,
  Clock,
  Loader2,
  ChevronDown,
  ChevronUp,
  Timer,
} from "lucide-react";
import { hapticNotification } from "@/lib/telegram";

const statusStyles: Record<string, string> = {
  upcoming: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  active: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  completed: "bg-muted text-muted-foreground border-border",
};

function useCountdown(targetDate: string) {
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    const target = new Date(targetDate).getTime();
    const update = () => {
      const now = Date.now();
      const diff = target - now;
      if (diff <= 0) { setTimeLeft("Started"); return; }
      const days = Math.floor(diff / 86400000);
      const hours = Math.floor((diff % 86400000) / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      if (days > 0) setTimeLeft(`${days}d ${hours}h`);
      else if (hours > 0) setTimeLeft(`${hours}h ${mins}m`);
      else setTimeLeft(`${mins}m`);
    };
    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, [targetDate]);

  return timeLeft;
}

function CountdownBadge({ date }: { date: string }) {
  const timeLeft = useCountdown(date);
  if (!timeLeft || timeLeft === "Started") return null;
  return (
    <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/30 text-xs">
      <Timer className="w-3 h-3 mr-1" />{timeLeft}
    </Badge>
  );
}

export default function Hackathons() {
  const { toast } = useToast();
  const { dbUser } = useUser();
  const { data: hackathons = [], isLoading } = useHackathons();
  const { data: registeredIds = [] } = useUserHackathonRegistrations();
  const registerMutation = useRegisterHackathon();
  const [selectedHackathon, setSelectedHackathon] = useState<any | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const balance = dbUser?.balance ?? 0;

  const handleRegister = async () => {
    if (!selectedHackathon) return;
    try {
      const result = await registerMutation.mutateAsync(selectedHackathon.id);
      if (result?.success) {
        hapticNotification("success");
        toast({ title: "Registered! 🚀", description: `You're in for "${result.hackathon}". ${result.fee_paid} DR deducted.` });
        setSelectedHackathon(null);
      } else {
        hapticNotification("error");
        toast({ title: "Registration Failed", description: result?.error || "Please try again.", variant: "destructive" });
      }
    } catch {
      hapticNotification("error");
      toast({ title: "Error", description: "Registration failed.", variant: "destructive" });
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pb-20 px-4 pt-6">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <h1 className="text-2xl font-bold text-foreground mb-2">Hackathons 🚀</h1>
        <p className="text-muted-foreground">Register for hackathons using your earned Dreams</p>
      </motion.div>

      {/* Balance */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mb-6">
        <Card className="gradient-card border-border/50 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
            <Coins className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Available Balance</p>
            <p className="text-lg font-bold text-primary">{balance.toLocaleString()} DR</p>
          </div>
        </Card>
      </motion.div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : hackathons.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No hackathons available right now.</p>
      ) : (
        <div className="space-y-4">
          {hackathons.map((hackathon: any, index: number) => {
            const isRegistered = registeredIds.includes(hackathon.id);
            const isFull = hackathon.max_teams && hackathon.registered_count >= hackathon.max_teams;
            const isExpanded = expandedId === hackathon.id;
            const capacityPercent = hackathon.max_teams ? Math.round((hackathon.registered_count / hackathon.max_teams) * 100) : 0;

            return (
              <motion.div key={hackathon.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + index * 0.08 }}>
                <Card className="gradient-card border-border/50 p-5">
                  {hackathon.cover_image_url && (
                    <img
                      src={hackathon.cover_image_url}
                      alt={hackathon.title}
                      className="w-full h-36 object-cover rounded-lg mb-3 -mt-1"
                    />
                  )}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={statusStyles[hackathon.status] || ""}>{hackathon.status}</Badge>
                      {hackathon.status === "upcoming" && <CountdownBadge date={hackathon.start_date} />}
                    </div>
                    <div className="flex items-center gap-1 text-primary font-semibold text-sm">
                      <Coins className="w-3.5 h-3.5" />{hackathon.entry_fee} DR
                    </div>
                  </div>

                  <h3 className="text-lg font-semibold text-foreground mb-2">{hackathon.title}</h3>

                  <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
                    <span className="flex items-center gap-1">
                      <CalendarDays className="w-3.5 h-3.5" />
                      {new Date(hackathon.start_date).toLocaleDateString("en-NG", { month: "short", day: "numeric" })} – {new Date(hackathon.end_date).toLocaleDateString("en-NG", { month: "short", day: "numeric" })}
                    </span>
                    {hackathon.max_teams && (
                      <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{hackathon.registered_count}/{hackathon.max_teams}</span>
                    )}
                    <span className="flex items-center gap-1"><Trophy className="w-3.5 h-3.5 text-primary" />{hackathon.prize_pool} DR</span>
                  </div>

                  {/* Capacity bar */}
                  {hackathon.max_teams && (
                    <div className="w-full h-1.5 bg-secondary rounded-full mb-3 overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${capacityPercent}%` }} />
                    </div>
                  )}

                  {/* Expandable detail */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden mb-3"
                      >
                        {hackathon.description && (
                          <p className="text-sm text-muted-foreground leading-relaxed mb-3">{hackathon.description}</p>
                        )}
                        <div className="bg-secondary rounded-lg p-3 space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Entry Fee</span>
                            <span className="text-foreground font-medium">{hackathon.entry_fee} DR</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Prize Pool</span>
                            <span className="text-primary font-medium">{hackathon.prize_pool} DR</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Capacity</span>
                            <span className="text-foreground">{hackathon.registered_count}/{hackathon.max_teams || "Unlimited"}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Duration</span>
                            <span className="text-foreground">
                              {Math.ceil((new Date(hackathon.end_date).getTime() - new Date(hackathon.start_date).getTime()) / 86400000)} days
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="flex items-center justify-between">
                    <Button size="sm" variant="ghost" className="text-xs text-muted-foreground" onClick={() => toggleExpand(hackathon.id)}>
                      {isExpanded ? <><ChevronUp className="w-3 h-3 mr-1" />Less</> : <><ChevronDown className="w-3 h-3 mr-1" />Details</>}
                    </Button>

                    {hackathon.status === "completed" ? (
                      <Badge className="bg-muted text-muted-foreground"><Clock className="w-3 h-3 mr-1" />Ended</Badge>
                    ) : isRegistered ? (
                      <Badge className="bg-primary/20 text-primary border-primary/30"><CheckCircle className="w-3 h-3 mr-1" />Registered</Badge>
                    ) : (
                      <Button size="sm" disabled={isFull} onClick={() => setSelectedHackathon(hackathon)} className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-glow">
                        <Rocket className="w-3 h-3 mr-1" />{isFull ? "Full" : "Register"}
                      </Button>
                    )}
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Registration modal */}
      <AnimatePresence>
        {selectedHackathon && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end justify-center" onClick={() => setSelectedHackathon(null)}>
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 300 }} className="w-full max-w-md bg-card border-t border-border rounded-t-2xl p-6" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-foreground text-lg">Confirm Registration</h3>
                <Button size="icon" variant="ghost" onClick={() => setSelectedHackathon(null)}><X className="w-4 h-4" /></Button>
              </div>
              <p className="text-foreground font-medium mb-1">{selectedHackathon.title}</p>
              <p className="text-sm text-muted-foreground mb-4">
                {new Date(selectedHackathon.start_date).toLocaleDateString()} – {new Date(selectedHackathon.end_date).toLocaleDateString()}
              </p>
              <div className="gradient-card border border-border/50 rounded-lg p-4 mb-4">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-muted-foreground">Entry Fee</span>
                  <span className="text-primary font-semibold">{selectedHackathon.entry_fee} DR</span>
                </div>
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-muted-foreground">Your Balance</span>
                  <span className="text-foreground font-semibold">{balance.toLocaleString()} DR</span>
                </div>
                <div className="border-t border-border/50 pt-2 mt-2 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">After Registration</span>
                  <span className={balance >= selectedHackathon.entry_fee ? "text-foreground font-semibold" : "text-destructive font-semibold"}>
                    {(balance - selectedHackathon.entry_fee).toLocaleString()} DR
                  </span>
                </div>
              </div>
              <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-glow" onClick={handleRegister} disabled={balance < selectedHackathon.entry_fee || registerMutation.isPending}>
                {registerMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Rocket className="w-4 h-4 mr-2" />}
                {balance < selectedHackathon.entry_fee ? "Insufficient Dreams" : "Confirm & Pay"}
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
