import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { ArrowUpRight, ArrowDownLeft, Gift, Target, CheckCircle, Rocket, Send, ArrowDownRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface Transaction {
  id: string;
  type: string;
  amount: number;
  description: string;
  created_at?: string;
  timestamp?: string;
}

interface TransactionListProps {
  transactions: Transaction[];
  showAll?: boolean;
}

const getTransactionIcon = (type: string) => {
  switch (type) {
    case "mission":
      return Target;
    case "redeem":
      return Gift;
    case "earn":
      return ArrowUpRight;
    case "checkin":
      return CheckCircle;
    case "hackathon_fee":
      return Rocket;
    case "hackathon_prize":
      return Rocket;
    case "transfer_out":
      return Send;
    case "transfer_in":
      return ArrowDownRight;
    default:
      return ArrowDownLeft;
  }
};

const isPositiveType = (type: string) => {
  return !["redeem", "hackathon_fee"].includes(type);
};

const getTransactionColor = (type: string) => {
  return isPositiveType(type) ? "text-primary" : "text-destructive";
};

export default function TransactionList({ transactions, showAll = false }: TransactionListProps) {
  const displayTransactions = showAll ? transactions : transactions.slice(0, 5);

  return (
    <div className="space-y-3">
      {displayTransactions.map((transaction, index) => {
        const Icon = getTransactionIcon(transaction.type);
        const positive = transaction.amount > 0;
        const dateStr = transaction.created_at || transaction.timestamp || "";

        return (
          <motion.div
            key={transaction.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card className="gradient-card border-border/50 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center",
                    positive ? "bg-primary/20" : "bg-destructive/20"
                  )}>
                    <Icon className={cn(
                      "w-5 h-5",
                      positive ? "text-primary" : "text-destructive"
                    )} />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">
                      {transaction.description}
                    </p>
                    <span className="text-[10px] text-muted-foreground capitalize">{transaction.type.replace(/_/g, ' ')}</span>
                    {dateStr && (
                      <p className="text-sm text-muted-foreground">
                        {new Date(dateStr).toLocaleDateString("en-NG", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    )}
                  </div>
                </div>

                <div className="text-right">
                  <p className={cn(
                    "font-bold",
                    positive ? "text-primary" : "text-destructive"
                  )}>
                    {positive ? "+" : ""}{transaction.amount} DR
                  </p>
                </div>
              </div>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
}
