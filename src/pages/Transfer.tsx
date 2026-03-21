import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Confetti } from "@/components/Confetti";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/contexts/UserContext";
import { useTransferDR } from "@/hooks/useSupabase";
import { hapticNotification } from "@/lib/telegram";
import { supabase } from "@/lib/supabase";
import { notifyTransferReceived } from "@/lib/notifications";
import {
  Send,
  Coins,
  AtSign,
  MessageSquare,
  Loader2,
  CheckCircle,
  X,
} from "lucide-react";

const sanitize = (input: string) => input.replace(/<[^>]*>/g, "").trim();

export default function Transfer() {
  const { toast } = useToast();
  const { dbUser } = useUser();
  const transferMutation = useTransferDR();

  const [username, setUsername] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [lookupResult, setLookupResult] = useState<{ found: boolean; name?: string } | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  // Load saved draft from localStorage on mount
  useEffect(() => {
    const draft = localStorage.getItem("transfer_draft");
    if (draft) {
      try {
        const { username: u, amount: a, note: n } = JSON.parse(draft);
        if (u) setUsername(u);
        if (a) setAmount(a);
        if (n) setNote(n);
      } catch {}
    }
  }, []);

  // Save draft on change (debounced)
  useEffect(() => {
    if (username || amount || note) {
      const timer = setTimeout(() => {
        localStorage.setItem("transfer_draft", JSON.stringify({ username, amount, note }));
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [username, amount, note]);

  useEffect(() => {
    const trimmed = username.trim().replace(/^@/, "");
    if (trimmed.length < 3) { setLookupResult(null); return; }
    setLookupLoading(true);
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from("users")
        .select("first_name")
        .ilike("username", trimmed)
        .maybeSingle();
      setLookupResult(data ? { found: true, name: data.first_name } : { found: false });
      setLookupLoading(false);
    }, 500);
    return () => { clearTimeout(timer); setLookupLoading(false); };
  }, [username]);

  const balance = dbUser?.balance ?? 0;
  const parsedAmount = parseInt(amount) || 0;

  const handleReview = () => {
    const newErrors: Record<string, string> = {};
    if (!username.trim()) newErrors.username = "Enter a recipient username";
    if (parsedAmount < 5) newErrors.amount = "Minimum transfer is 5 DR";
    if (parsedAmount > balance) newErrors.amount = "Insufficient balance";
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setErrors({});
    setShowConfirm(true);
  };

  const handleConfirmTransfer = async () => {
    try {
      const result = await transferMutation.mutateAsync({
        recipientUsername: username.trim().replace(/^@/, ""),
        amount: parsedAmount,
        note: note.trim() || undefined,
      });

      if (result?.success) {
        hapticNotification("success");
        setShowConfetti(true);
        setLastResult(result);
        setShowConfirm(false);
        setUsername("");
        setAmount("");
        setNote("");
        localStorage.removeItem("transfer_draft");
        toast({ title: "Transfer Sent! ✅", description: `${result.amount} DR sent to @${result.recipient_username}` });
        // Notify recipient
        const { data: recipient } = await supabase
          .from("users")
          .select("telegram_id")
          .ilike("username", result.recipient_username)
          .maybeSingle();
        if (recipient?.telegram_id) {
          notifyTransferReceived(recipient.telegram_id, result.amount, dbUser?.username || dbUser?.first_name || "Someone", note.trim() || undefined);
        }
      } else {
        hapticNotification("error");
        toast({ title: "Transfer Failed", description: result?.error || "Please try again.", variant: "destructive" });
      }
    } catch {
      hapticNotification("error");
      toast({ title: "Error", description: "Transfer failed.", variant: "destructive" });
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="pb-20 px-4 pt-6"
    >
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <h1 className="text-2xl font-bold text-foreground mb-2">Transfer DR</h1>
        <p className="text-muted-foreground">Send Dreamers Coins to another user</p>
      </motion.div>

      {/* Balance */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card className="gradient-card border-border/50 p-4 mb-6">
          <div className="flex items-center justify-center gap-3">
            <Coins className="w-6 h-6 text-primary" />
            <span className="text-lg font-semibold text-foreground">
              Available: {balance.toLocaleString()} DR
            </span>
          </div>
        </Card>
      </motion.div>

      {/* Success message */}
      <AnimatePresence>
        {lastResult && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="mb-6"
          >
            <Card className="border-emerald-500/30 bg-emerald-500/10 p-4">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-emerald-400" />
                <div>
                  <p className="font-medium text-foreground">Transfer Complete</p>
                  <p className="text-sm text-muted-foreground">
                    {lastResult.amount} DR sent to @{lastResult.recipient_username}
                  </p>
                </div>
                <Button size="icon" variant="ghost" className="ml-auto h-7 w-7" aria-label="Dismiss" onClick={() => setLastResult(null)}>
                  <X className="w-3 h-3" />
                </Button>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Transfer Form */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Card className="gradient-card border-border/50 p-5">
          <div className="space-y-4">
            {/* Recipient */}
            <div>
              <label className="text-sm font-medium text-foreground block mb-2">Recipient</label>
              <div className="relative">
                <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="username"
                  value={username}
                  onChange={(e) => {
                    setUsername(sanitize(e.target.value));
                    if (errors.username) setErrors((prev) => { const { username, ...rest } = prev; return rest; });
                  }}
                  className="pl-9 bg-secondary border-border"
                />
              </div>
              {errors.username ? (
                <p className="text-xs text-destructive mt-1">{errors.username}</p>
              ) : (
                <p className="text-xs text-muted-foreground mt-1">Enter the Telegram username of the recipient</p>
              )}
              {lookupLoading && <p className="text-xs text-muted-foreground mt-1">Looking up...</p>}
              {lookupResult && !lookupLoading && !errors.username && (
                lookupResult.found
                  ? <p className="text-xs text-emerald-400 mt-1">Found: {lookupResult.name}</p>
                  : <p className="text-xs text-destructive mt-1">User not found</p>
              )}
            </div>

            {/* Amount */}
            <div>
              <label className="text-sm font-medium text-foreground block mb-2">Amount</label>
              <div className="relative">
                <Coins className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary" />
                <Input
                  type="number"
                  placeholder="0"
                  min={5}
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    if (errors.amount) setErrors((prev) => { const { amount, ...rest } = prev; return rest; });
                  }}
                  className="pl-9 bg-secondary border-border text-lg font-semibold"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">DR</span>
              </div>
              {errors.amount ? (
                <p className="text-xs text-destructive mt-1">{errors.amount}</p>
              ) : (
                <p className="text-xs text-muted-foreground mt-1">Minimum: 5 DR</p>
              )}
            </div>

            {/* Quick amounts */}
            <div className="flex gap-2">
              {[5, 25, 50, 100, 500].map((val) => (
                <Button
                  key={val}
                  size="sm"
                  variant="outline"
                  className="flex-1 border-primary/30 text-primary hover:bg-primary/10"
                  onClick={() => setAmount(String(val))}
                  disabled={val > balance}
                >
                  {val}
                </Button>
              ))}
            </div>

            {/* Note */}
            <div>
              <label className="text-sm font-medium text-foreground block mb-2">Note (optional)</label>
              <div className="relative">
                <MessageSquare className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="What's this for?"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="pl-9 bg-secondary border-border"
                />
              </div>
            </div>

            {/* Summary */}
            {parsedAmount > 0 && (
              <div className="bg-secondary rounded-lg p-3 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Amount</span>
                  <span className="text-foreground">{parsedAmount} DR</span>
                </div>
                <div className="border-t border-border/50 pt-1 flex justify-between text-sm">
                  <span className="text-muted-foreground">Remaining</span>
                  <span className={balance - parsedAmount < 0 ? "text-destructive font-semibold" : "text-foreground font-semibold"}>
                    {(balance - parsedAmount).toLocaleString()} DR
                  </span>
                </div>
              </div>
            )}

            <Button
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-glow"
              onClick={handleReview}
              disabled={!username.trim() || parsedAmount < 5 || parsedAmount > balance}
            >
              <Send className="w-4 h-4 mr-2" />
              Review Transfer
            </Button>
          </div>
        </Card>
      </motion.div>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {showConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end justify-center"
            onClick={() => setShowConfirm(false)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="w-full max-w-md bg-card border-t border-border rounded-t-2xl p-6"
              onClick={(e) => e.stopPropagation()}
              drag="y"
              dragConstraints={{ top: 0 }}
              dragElastic={0.2}
              onDragEnd={(_, info) => {
                if (info.offset.y > 100) {
                  setShowConfirm(false);
                }
              }}
            >
              <div className="w-10 h-1 bg-border rounded-full mx-auto mb-4" />
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-foreground text-lg">Confirm Transfer</h3>
                <Button size="icon" variant="ghost" aria-label="Close" onClick={() => setShowConfirm(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <div className="gradient-card border border-border/50 rounded-lg p-4 mb-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">To</span>
                  <span className="text-foreground font-semibold">@{username.replace(/^@/, "")}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Amount</span>
                  <span className="text-primary font-semibold">{parsedAmount} DR</span>
                </div>
                {note && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Note</span>
                    <span className="text-foreground">{note}</span>
                  </div>
                )}
                <div className="border-t border-border/50 pt-2 flex justify-between text-sm">
                  <span className="text-muted-foreground">After Transfer</span>
                  <span className="text-foreground font-semibold">{(balance - parsedAmount).toLocaleString()} DR</span>
                </div>
              </div>

              <Button
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-glow"
                onClick={handleConfirmTransfer}
                disabled={transferMutation.isPending}
              >
                {transferMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Send className="w-4 h-4 mr-2" />
                )}
                Send {parsedAmount} DR
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <Confetti active={showConfetti} onComplete={() => setShowConfetti(false)} />
    </motion.div>
  );
}
