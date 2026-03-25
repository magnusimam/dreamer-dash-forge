import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useRaffles, useUserRaffleEntries, useEnterRaffle } from "@/hooks/useSupabase";
import { useUser } from "@/contexts/UserContext";
import { Coins, Ticket, Trophy, Clock, Users, Loader2, X, CheckCircle, Timer, Rocket } from "lucide-react";
import { hapticNotification } from "@/lib/telegram";
import { SkeletonList } from "@/components/SkeletonCard";
import { Confetti } from "@/components/Confetti";

function useCountdown(targetDate: string) {
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    const target = new Date(targetDate).getTime();
    const update = () => {
      const now = Date.now();
      const diff = target - now;
      if (diff <= 0) { setTimeLeft("Ended"); return; }
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

function RaffleCard({ raffle, isEntered, onEnter }: { raffle: any; isEntered: boolean; onEnter: (r: any) => void }) {
  const countdown = useCountdown(raffle.end_date);
  const isEnded = raffle.status === "ended" || new Date(raffle.end_date) < new Date();
  const winner = raffle.winner as any;

  return (
    <Card className="gradient-card border-border/50 p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="font-semibold text-foreground">{raffle.title}</h3>
          {raffle.description && <p className="text-xs text-muted-foreground mt-1">{raffle.description}</p>}
        </div>
        <Badge variant="outline" className={isEnded ? "bg-muted text-muted-foreground border-border" : "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"}>
          {isEnded ? "Ended" : "Active"}
        </Badge>
      </div>

      <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
        <span className="flex items-center gap-1"><Coins className="w-3 h-3 text-primary" />{raffle.entry_fee} DR</span>
        {!isEnded && <span className="flex items-center gap-1"><Timer className="w-3 h-3" />{countdown}</span>}
        {raffle.max_entries && <span className="flex items-center gap-1"><Users className="w-3 h-3" />Max {raffle.max_entries}</span>}
      </div>

      {winner && (
        <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 mb-3">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-primary" />
            <span className="text-sm text-foreground font-medium">
              Winner: {winner.first_name}{winner.username ? ` (@${winner.username})` : ""}
            </span>
          </div>
        </div>
      )}

      {!isEnded && (
        isEntered ? (
          <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            <span className="text-sm text-emerald-400 font-medium">Entered</span>
          </div>
        ) : (
          <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground" onClick={() => onEnter(raffle)}>
            <Ticket className="w-4 h-4 mr-2" /> Enter Raffle — {raffle.entry_fee} DR
          </Button>
        )
      )}
    </Card>
  );
}

interface RafflesProps {
  onTabChange?: (tab: string) => void;
}

export default function Raffles({ onTabChange }: RafflesProps) {
  const { toast } = useToast();
  const { dbUser } = useUser();
  const { data: raffles, isLoading } = useRaffles();
  const { data: enteredIds = [] } = useUserRaffleEntries();
  const enterMutation = useEnterRaffle();
  const [confirmRaffle, setConfirmRaffle] = useState<any>(null);
  const [showConfetti, setShowConfetti] = useState(false);

  const balance = dbUser?.balance ?? 0;

  const handleConfirmEntry = async () => {
    if (!confirmRaffle) return;
    try {
      const result = await enterMutation.mutateAsync(confirmRaffle.id);
      if (result?.success) {
        hapticNotification("success");
        setShowConfetti(true);
        toast({ title: "You're in!", description: `Entered ${result.raffle} for ${result.fee} DR` });
      } else {
        hapticNotification("error");
        toast({ title: "Failed", description: result?.error, variant: "destructive" });
      }
    } catch {
      hapticNotification("error");
      toast({ title: "Error", description: "Failed to enter raffle.", variant: "destructive" });
    }
    setConfirmRaffle(null);
  };

  if (isLoading) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pb-28 px-4 pt-6">
        <SkeletonList count={3} />
      </motion.div>
    );
  }

  const activeRaffles = (raffles || []).filter((r: any) => r.status === "active" && new Date(r.end_date) > new Date());
  const endedRaffles = (raffles || []).filter((r: any) => r.status === "ended" || new Date(r.end_date) <= new Date());

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pb-28 px-4 pt-6">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground mb-1">Raffles</h1>
            <p className="text-muted-foreground text-sm">Spend DR for a chance to win big</p>
          </div>
          {onTabChange && (
            <Button size="sm" className="bg-primary/15 text-primary border border-primary/30 hover:bg-primary/25" onClick={() => onTabChange("hackathons")}>
              <Rocket className="w-4 h-4 mr-1.5" /> Hackathons
            </Button>
          )}
        </div>
      </motion.div>

      {/* Balance */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card className="gradient-card border-border/50 p-4 mb-6">
          <div className="flex items-center justify-center gap-3">
            <Coins className="w-6 h-6 text-primary" />
            <span className="text-lg font-semibold text-foreground">
              {balance.toLocaleString()} DR
            </span>
          </div>
        </Card>
      </motion.div>

      {activeRaffles.length === 0 && endedRaffles.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">No raffles yet. Check back soon!</p>
      )}

      {activeRaffles.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-foreground mb-3">Active Raffles</h2>
          <div className="space-y-3">
            {activeRaffles.map((r: any) => (
              <motion.div key={r.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                <RaffleCard raffle={r} isEntered={enteredIds.includes(r.id)} onEnter={setConfirmRaffle} />
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {endedRaffles.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground mb-3">Past Raffles</h2>
          <div className="space-y-3">
            {endedRaffles.map((r: any) => (
              <motion.div key={r.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                <RaffleCard raffle={r} isEntered={enteredIds.includes(r.id)} onEnter={setConfirmRaffle} />
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Entry confirmation modal */}
      <AnimatePresence>
        {confirmRaffle && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-end justify-center" onClick={() => setConfirmRaffle(null)}>
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 300 }} className="w-full max-w-md bg-card border-t border-border rounded-t-2xl p-6 pb-16" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-foreground text-lg">Enter Raffle</h3>
                <Button size="icon" variant="ghost" aria-label="Close" onClick={() => setConfirmRaffle(null)}><X className="w-4 h-4" /></Button>
              </div>

              <div className="gradient-card border border-border/50 rounded-lg p-4 mb-4 space-y-2">
                <p className="font-medium text-foreground">{confirmRaffle.title}</p>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Entry Fee</span>
                  <span className="text-primary font-semibold">{confirmRaffle.entry_fee} DR</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Your Balance</span>
                  <span className="text-foreground">{balance.toLocaleString()} DR</span>
                </div>
                <div className="border-t border-border/50 pt-2 flex justify-between text-sm">
                  <span className="text-muted-foreground">After Entry</span>
                  <span className={balance - confirmRaffle.entry_fee < 0 ? "text-destructive font-semibold" : "text-foreground font-semibold"}>
                    {(balance - confirmRaffle.entry_fee).toLocaleString()} DR
                  </span>
                </div>
              </div>

              <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-glow" onClick={handleConfirmEntry} disabled={enterMutation.isPending || balance < confirmRaffle.entry_fee}>
                {enterMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Ticket className="w-4 h-4 mr-2" />}
                Confirm & Pay {confirmRaffle.entry_fee} DR
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Confetti active={showConfetti} onComplete={() => setShowConfetti(false)} />
    </motion.div>
  );
}
