import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Confetti } from "@/components/Confetti";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/contexts/UserContext";
import { useTransferDR, isUserOnline } from "@/hooks/useSupabase";
import { useQuery } from "@tanstack/react-query";
import { hapticNotification } from "@/lib/telegram";
import { supabase } from "@/lib/supabase";
import { notifyTransferReceived } from "@/lib/notifications";
import {
  Send,
  Coins,
  Search,
  MessageSquare,
  Loader2,
  CheckCircle,
  X,
  User,
} from "lucide-react";

const sanitize = (input: string) => input.replace(/<[^>]*>/g, "").trim();

interface UserMatch {
  id: string;
  first_name: string;
  last_name: string | null;
  username: string | null;
  telegram_id: number;
  last_active: string | null;
}

export default function Transfer() {
  const { toast } = useToast();
  const { dbUser } = useUser();
  const transferMutation = useTransferDR();

  const [searchInput, setSearchInput] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserMatch | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [suggestions, setSuggestions] = useState<UserMatch[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Load saved draft from localStorage on mount
  useEffect(() => {
    const draft = localStorage.getItem("transfer_draft");
    if (draft) {
      try {
        const { amount: a, note: n } = JSON.parse(draft);
        if (a) setAmount(a);
        if (n) setNote(n);
      } catch {}
    }
  }, []);

  // Save draft on change (debounced)
  useEffect(() => {
    if (amount || note) {
      const timer = setTimeout(() => {
        localStorage.setItem("transfer_draft", JSON.stringify({ amount, note }));
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [amount, note]);

  // Debounced user search
  useEffect(() => {
    if (selectedUser) return; // Don't search if user already selected
    const trimmed = searchInput.trim().replace(/^@/, "");
    if (trimmed.length < 2) { setSuggestions([]); setShowDropdown(false); return; }
    setSearchLoading(true);
    const timer = setTimeout(async () => {
      const escaped = trimmed.replace(/%/g, "\\%").replace(/_/g, "\\_");
      const { data } = await supabase
        .from("users")
        .select("id, first_name, last_name, username, telegram_id, last_active")
        .or(`username.ilike.%${escaped}%,first_name.ilike.%${escaped}%`)
        .neq("id", dbUser?.id || "")
        .limit(10);
      setSuggestions(data || []);
      setShowDropdown(true);
      setSearchLoading(false);
    }, 300);
    return () => { clearTimeout(timer); setSearchLoading(false); };
  }, [searchInput, selectedUser, dbUser?.id]);

  const handleSelectUser = (user: UserMatch) => {
    setSelectedUser(user);
    setSearchInput(user.username ? `@${user.username}` : user.first_name);
    setShowDropdown(false);
    if (errors.username) setErrors((prev) => { const { username, ...rest } = prev; return rest; });
  };

  const handleClearSelection = () => {
    setSelectedUser(null);
    setSearchInput("");
    setSuggestions([]);
    inputRef.current?.focus();
  };

  const balance = dbUser?.balance ?? 0;
  const status = dbUser?.status ?? "Bronze";
  const dailyLimit = status === "Diamond" ? Infinity : status === "Gold" ? 20 : status === "Silver" ? 10 : 5;
  const { data: todayTransfers = 0 } = useQuery({
    queryKey: ["today_transfers", dbUser?.id],
    queryFn: async () => {
      if (!dbUser) return 0;
      const today = new Date().toISOString().split("T")[0];
      const { count } = await supabase.from("transactions").select("*", { count: "exact", head: true }).eq("user_id", dbUser.id).eq("type", "transfer_out").gte("created_at", today);
      return count ?? 0;
    },
    enabled: !!dbUser,
  });
  const transfersRemaining = dailyLimit === Infinity ? Infinity : dailyLimit - todayTransfers;
  const parsedAmount = parseInt(amount) || 0;

  const handleReview = () => {
    const newErrors: Record<string, string> = {};
    if (!selectedUser) newErrors.username = "Select a recipient from the dropdown";
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
    if (!selectedUser) return;
    try {
      const recipientIdentifier = selectedUser.username || selectedUser.first_name;
      const result = await transferMutation.mutateAsync({
        recipientUsername: recipientIdentifier,
        amount: parsedAmount,
        note: note.trim() || undefined,
      });

      if (result?.success) {
        hapticNotification("success");
        setShowConfetti(true);
        setLastResult(result);
        setShowConfirm(false);
        setSelectedUser(null);
        setSearchInput("");
        setAmount("");
        setNote("");
        localStorage.removeItem("transfer_draft");
        const displayName = result.recipient_username || result.recipient;
        toast({ title: "Transfer Sent!", description: `${result.amount} DR sent to ${displayName}` });
        // Notify recipient
        if (selectedUser.telegram_id) {
          notifyTransferReceived(selectedUser.telegram_id, result.amount, dbUser?.username || dbUser?.first_name || "Someone", note.trim() || undefined);
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
      className="pb-28 px-4 pt-6"
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
          <p className="text-xs text-muted-foreground text-center mt-1">
            {transfersRemaining === Infinity ? (
              "Unlimited transfers (Diamond)"
            ) : transfersRemaining > 0 ? (
              `${transfersRemaining} transfer${transfersRemaining !== 1 ? "s" : ""} remaining today (${status})`
            ) : (
              <span className="text-destructive">Daily limit reached ({dailyLimit}/day for {status})</span>
            )}
          </p>
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
            <div ref={dropdownRef}>
              <label className="text-sm font-medium text-foreground block mb-2">Recipient</label>
              <div className="relative">
                {selectedUser ? (
                  <div className="flex items-center gap-2 bg-secondary border border-emerald-500/30 rounded-md px-3 py-2">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                      <User className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {selectedUser.first_name}{selectedUser.last_name ? ` ${selectedUser.last_name}` : ""}
                      </p>
                      {selectedUser.username && (
                        <p className="text-xs text-muted-foreground">@{selectedUser.username}</p>
                      )}
                    </div>
                    <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" aria-label="Clear" onClick={handleClearSelection}>
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      ref={inputRef}
                      placeholder="Search by name or username..."
                      value={searchInput}
                      onChange={(e) => {
                        setSearchInput(sanitize(e.target.value));
                        if (errors.username) setErrors((prev) => { const { username, ...rest } = prev; return rest; });
                      }}
                      onFocus={() => { if (suggestions.length > 0) setShowDropdown(true); }}
                      className="pl-9 bg-secondary border-border"
                    />
                    {searchLoading && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
                    )}
                  </>
                )}

                {/* Dropdown */}
                <AnimatePresence>
                  {showDropdown && !selectedUser && suggestions.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.15 }}
                      className="absolute z-50 w-full mt-1 bg-card border border-border rounded-lg shadow-lg overflow-hidden max-h-48 overflow-y-auto"
                    >
                      {suggestions.map((user) => (
                        <button
                          key={user.id}
                          type="button"
                          className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-secondary/80 active:bg-secondary transition-colors text-left"
                          onClick={() => handleSelectUser(user)}
                        >
                          <div className="relative w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <User className="w-4 h-4 text-primary" />
                            <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-card ${isUserOnline(user.last_active) ? "bg-emerald-400" : "bg-muted-foreground/30"}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">
                              {user.first_name}{user.last_name ? ` ${user.last_name}` : ""}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {user.username ? `@${user.username}` : "No username"}
                            </p>
                          </div>
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* No results message */}
                {showDropdown && !selectedUser && searchInput.trim().length >= 2 && !searchLoading && suggestions.length === 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-lg shadow-lg px-3 py-3">
                    <p className="text-xs text-muted-foreground text-center">No users found</p>
                  </div>
                )}
              </div>
              {errors.username && (
                <p className="text-xs text-destructive mt-1">{errors.username}</p>
              )}
              {!selectedUser && !errors.username && (
                <p className="text-xs text-muted-foreground mt-1">Type to search for a user</p>
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
              disabled={!selectedUser || parsedAmount < 5 || parsedAmount > balance}
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
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-end justify-center"
            onClick={() => setShowConfirm(false)}
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
                  <span className="text-foreground font-semibold">
                    {selectedUser?.first_name}{selectedUser?.last_name ? ` ${selectedUser.last_name}` : ""}
                    {selectedUser?.username ? ` (@${selectedUser.username})` : ""}
                  </span>
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
