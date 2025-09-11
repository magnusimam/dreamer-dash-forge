import { motion } from "framer-motion";
import TransactionList from "@/components/TransactionList";
import { mockTransactions } from "@/data/mockData";

export default function Transactions() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="pb-20 px-4 pt-6"
    >
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <h1 className="text-2xl font-bold text-foreground mb-2">
          Transaction History 📊
        </h1>
        <p className="text-muted-foreground">
          View all your Dreamers Coin activities
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <TransactionList transactions={mockTransactions} showAll />
      </motion.div>
    </motion.div>
  );
}