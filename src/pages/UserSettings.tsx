import { useState } from "react";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/contexts/UserContext";
import { useSetBirthday, useSaveBankDetails } from "@/hooks/useSupabase";
import { Cake, Building2, X, Loader2, ChevronRight } from "lucide-react";

export default function UserSettings() {
  const { toast } = useToast();
  const { dbUser } = useUser();
  const setBirthdayMutation = useSetBirthday();
  const saveBankMutation = useSaveBankDetails();

  const [bankName, setBankName] = useState(dbUser?.bank_name || "");
  const [accountNumber, setAccountNumber] = useState(dbUser?.account_number || "");
  const [accountName, setAccountName] = useState(dbUser?.account_name || "");
  const [editingBank, setEditingBank] = useState(!dbUser?.bank_name);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pb-28 px-4 pt-6">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <h1 className="text-2xl font-bold text-foreground mb-2">Settings</h1>
        <p className="text-muted-foreground">Manage your personal details</p>
      </motion.div>

      {/* Birthday */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card className="gradient-card border-border/50 p-5 mb-4">
          <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
            <Cake className="w-4 h-4 text-pink-400" /> Birthday
          </h3>
          {dbUser?.birthday && (
            <p className="text-sm text-foreground mb-2">
              Current: {new Date(dbUser.birthday).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
            </p>
          )}
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dbUser?.birthday || ""}
              className="flex-1 h-9 px-3 rounded-md bg-secondary border border-border text-foreground text-sm"
              onChange={async (e) => {
                if (e.target.value) {
                  try {
                    await setBirthdayMutation.mutateAsync(e.target.value);
                    toast({ title: "Birthday Updated!" });
                  } catch {
                    toast({ title: "Error", description: "Failed to save.", variant: "destructive" });
                  }
                }
              }}
            />
            {dbUser?.birthday && (
              <Button variant="ghost" size="sm" className="h-9 px-2 text-destructive" onClick={async () => {
                try {
                  await setBirthdayMutation.mutateAsync(null as any);
                  toast({ title: "Birthday Removed" });
                } catch {
                  toast({ title: "Error", variant: "destructive" });
                }
              }}>
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground mt-2">Your birthday will be visible on your profile and the community will be notified on the day</p>
        </Card>
      </motion.div>

      {/* Bank Details */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Card className="gradient-card border-border/50 p-5 mb-4">
          <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-blue-400" /> Bank Details
          </h3>
          <p className="text-[10px] text-muted-foreground mb-3">Other users can see this on your profile to send you gifts or payments</p>

          {dbUser?.bank_name && dbUser?.account_number && !editingBank ? (
            <div>
              <div className="bg-secondary/50 rounded-lg p-3 space-y-1 mb-3">
                <p className="text-sm font-medium text-foreground">{dbUser.account_name}</p>
                <p className="text-xs text-muted-foreground">{dbUser.bank_name}</p>
                <p className="text-xs text-foreground font-mono">{dbUser.account_number}</p>
              </div>
              <Button variant="outline" size="sm" className="w-full border-primary/30 text-primary" onClick={() => {
                setBankName(dbUser.bank_name || "");
                setAccountNumber(dbUser.account_number || "");
                setAccountName(dbUser.account_name || "");
                setEditingBank(true);
              }}>
                Edit Bank Details
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <Input placeholder="Bank name (e.g. Access Bank)" value={bankName} onChange={(e) => setBankName(e.target.value)} className="bg-secondary border-border" />
              <Input placeholder="Account number" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} className="bg-secondary border-border" />
              <Input placeholder="Account name" value={accountName} onChange={(e) => setAccountName(e.target.value)} className="bg-secondary border-border" />
              <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground" disabled={!bankName.trim() || !accountNumber.trim() || !accountName.trim() || saveBankMutation.isPending}
                onClick={async () => {
                  try {
                    await saveBankMutation.mutateAsync({ bank_name: bankName.trim(), account_number: accountNumber.trim(), account_name: accountName.trim() });
                    toast({ title: "Bank Details Saved!" });
                    setEditingBank(false);
                  } catch {
                    toast({ title: "Error", description: "Failed to save.", variant: "destructive" });
                  }
                }}>
                {saveBankMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Save Bank Details
              </Button>
              {dbUser?.bank_name && (
                <Button variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={() => setEditingBank(false)}>
                  Cancel
                </Button>
              )}
            </div>
          )}
        </Card>
      </motion.div>
    </motion.div>
  );
}
