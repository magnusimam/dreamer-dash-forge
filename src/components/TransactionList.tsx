import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { ArrowUpRight, ArrowDownLeft, Gift, Target } from "lucide-react";
import { cn } from "@/lib/utils";

interface Transaction {
  id: string;
  type: "earn" | "redeem" | "mission" | "bonus";
  amount: number;
  description: string;
  timestamp: string;
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
    default:
      return ArrowDownLeft;
  }
};

const getTransactionColor = (type: string) => {
  switch (type) {
    case "redeem":
      return "text-destructive";
    default:
      return "text-primary";
  }
};

export default function TransactionList({ transactions, showAll = false }: TransactionListProps) {
  const displayTransactions = showAll ? transactions : transactions.slice(0, 5);

  return (
    <div className="space-y-3">
      {displayTransactions.map((transaction, index) => {
        const Icon = getTransactionIcon(transaction.type);
        const isPositive = transaction.type !== "redeem";
        
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
                    isPositive ? "bg-primary/20" : "bg-destructive/20"
                  )}>
                    <Icon className={cn(
                      "w-5 h-5",
                      getTransactionColor(transaction.type)
                    )} />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">
                      {transaction.description}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(transaction.timestamp).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                
                <div className="text-right">
                  <p className={cn(
                    "font-bold",
                    getTransactionColor(transaction.type)
                  )}>
                    {isPositive ? "+" : "-"}{transaction.amount} DC
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