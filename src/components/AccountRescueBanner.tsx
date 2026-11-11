import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Heart, Loader2, X, Clock } from "lucide-react";
import { useAccountsAtRisk, useRescueTransfer, type AtRiskAccount } from "@/hooks/useSupabase";
import { useUser } from "@/contexts/UserContext";
import { useToast } from "@/hooks/use-toast";
import { hapticNotification } from "@/lib/telegram";
import { notifyUser } from "@/lib/notifications";

function timeLeft(iso: string, now: number) {
  const ms = new Date(iso).getTime() - now;
  if (ms <= 0) return "Deleting soon";
  const h = Math.floor(ms / 3600000);
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h left`;
  if (h >= 1) return `${h}h left`;
  return `${Math.max(1, Math.floor(ms / 60000))}m left`;
}

const DISMISSED_KEY = "rescue_banner_dismissed";

function loadDismissed(): string[] {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveDismissed(ids: string[]) {
  try {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(ids));
  } catch {
    /* storage unavailable — dismissal lasts for this session only */
  }
}

/**
 * Lists members whose account hit 0 DR through inactivity and will be
 * deleted when their 5-day window ends, with a one-tap way to send them DR.
 * The member themselves sees a "check in to save your account" notice instead.
 */
export default function AccountRescueBanner({ onRescued }: { onRescued?: () => void }) {
  const { data: atRisk } = useAccountsAtRisk();
  const rescue = useRescueTransfer();
  const { dbUser } = useUser();
  const { toast } = useToast();
  const [target, setTarget] = useState<AtRiskAccount | null>(null);
  const [amount, setAmount] = useState("");
  const [now, setNow] = useState(Date.now());
  const [dismissed, setDismissed] = useState<string[]>(loadDismissed);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(t);
  }, []);

  if (!atRisk || atRisk.length === 0) return null;

  const me = atRisk.find((a) => a.is_me);
  const others = atRisk.filter((a) => !a.is_me);
  // Hide the "Save a Dreamer" card once dismissed; it comes back only when a
  // new account (one not on screen at dismissal time) goes at risk.
  const showOthers = others.some((a) => !dismissed.includes(a.watch_id));

  const dismissOthers = () => {
    // Keep only ids still at risk so the stored list doesn't grow forever.
    const next = others.map((a) => a.watch_id);
    setDismissed(next);
    saveDismissed(next);
  };

  const send = async () => {
    if (!target) return;
    const amt = parseInt(amount);
    try {
      const result = await rescue.mutateAsync({ watchId: target.watch_id, amount: amt });
      if (result?.success) {
        hapticNotification("success");
        onRescued?.();
        toast({ title: "Account saved! 💛", description: `${result.amount} DR sent to ${result.recipient}.` });
        if (result.recipient_telegram_id) {
          const senderName = [dbUser?.first_name, dbUser?.last_name].filter(Boolean).join(" ");
          notifyUser(
            result.recipient_telegram_id,
            `💛 <b>Someone is saving your account!</b>\n\n<b>${senderName}</b> sent you <b>${result.amount} DR</b> so your account won't be deleted.\n\nOpen the app and check in to stay active!`
          );
        }
        setTarget(null);
        setAmount("");
      } else {
        hapticNotification("error");
        toast({ title: "Failed", description: result?.error, variant: "destructive" });
      }
    } catch (err: any) {
      hapticNotification("error");
      toast({ title: "Error", description: err?.message || "Transfer failed", variant: "destructive" });
    }
  };

  return (
    <>
      {me && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-4">
          <Card className="border-destructive/50 bg-destructive/10 p-4">
            <p className="text-sm font-semibold text-destructive">🚨 Your account is scheduled for deletion</p>
            <p className="text-xs text-muted-foreground mt-1">
              Your balance hit 0 DR after being inactive. Check in now to earn DR — if your balance is above 0 when
              the timer ends, your account is saved.
            </p>
            <p className="text-xs font-semibold text-destructive mt-2 flex items-center gap-1">
              <Clock className="w-3 h-3" /> {timeLeft(me.delete_after, now)}
            </p>
          </Card>
        </motion.div>
      )}

      {showOthers && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-4">
          <Card className="border-red-500/30 bg-red-500/10 p-4">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-semibold text-red-400 flex items-center gap-1.5">
                <Heart className="w-4 h-4" /> Save a Dreamer
              </p>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 -mt-1 -mr-1 text-muted-foreground hover:text-foreground"
                aria-label="Dismiss"
                onClick={dismissOthers}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              These accounts hit 0 DR from inactivity and will be deleted when the timer ends. Send any amount to save them.
            </p>
            <div className="space-y-2">
              {others.map((a) => {
                const name = [a.first_name, a.last_name].filter(Boolean).join(" ") || "Dreamer";
                const saved = a.balance > 0;
                return (
                  <div key={a.watch_id} className="flex items-center gap-3 rounded-lg bg-background/40 p-2">
                    <Avatar className="w-9 h-9">
                      <AvatarImage src={a.photo_url || undefined} />
                      <AvatarFallback>{name[0]}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{name}</p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {a.username ? `@${a.username}` : ""}{a.username && a.state ? " · " : ""}{a.state || ""}
                      </p>
                      <p className={`text-[10px] font-semibold ${saved ? "text-green-400" : "text-red-400"}`}>
                        {saved ? `Saved for now · ${a.balance} DR` : timeLeft(a.delete_after, now)}
                      </p>
                    </div>
                    <Button size="sm" className="h-8 text-xs bg-red-500 hover:bg-red-600 text-white shrink-0" onClick={() => setTarget(a)}>
                      <Heart className="w-3 h-3 mr-1" /> {saved ? "Send more" : "Save"}
                    </Button>
                  </div>
                );
              })}
            </div>
          </Card>
        </motion.div>
      )}

      <AnimatePresence>
        {target && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-end justify-center" onClick={() => setTarget(null)}>
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 300 }} className="w-full max-w-md bg-card border-t border-border rounded-t-2xl p-6 pb-16" onClick={(e) => e.stopPropagation()}>
              <div className="w-10 h-1 bg-border rounded-full mx-auto mb-4" />
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-foreground text-lg flex items-center gap-2">
                  <Heart className="w-5 h-5 text-red-400" /> Save {target.first_name || "this Dreamer"}
                </h3>
                <Button size="icon" variant="ghost" onClick={() => setTarget(null)}><X className="w-4 h-4" /></Button>
              </div>
              <p className="text-xs text-muted-foreground mb-4">
                Any DR in their balance when the timer ends keeps their account. Minimum 10 DR.
              </p>
              <div className="flex gap-2 mb-3">
                {[10, 25, 50, 100].map((val) => (
                  <Button key={val} size="sm" variant="outline" className={`flex-1 ${amount === String(val) ? "border-primary bg-primary/10 text-primary" : "border-border"}`} onClick={() => setAmount(String(val))}>
                    {val}
                  </Button>
                ))}
              </div>
              <Input type="number" placeholder="Or enter custom amount" value={amount} onChange={(e) => setAmount(e.target.value)} className="mb-4 bg-secondary border-border text-center text-lg font-semibold" />
              <Button className="w-full bg-red-500 hover:bg-red-600 text-white" disabled={!amount || parseInt(amount) < 10 || rescue.isPending} onClick={send}>
                {rescue.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Heart className="w-4 h-4 mr-2" />}
                Send {amount || "0"} DR
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
