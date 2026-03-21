import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import TransactionList from "@/components/TransactionList";
import { useTransactions } from "@/hooks/useSupabase";
import { Loader2, Search } from "lucide-react";
import { SkeletonList } from "@/components/SkeletonCard";
import { cn } from "@/lib/utils";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "earn", label: "Earned" },
  { key: "checkin", label: "Check-in" },
  { key: "mission", label: "Mission" },
  { key: "redeem", label: "Redeemed" },
  { key: "transfer_out", label: "Sent" },
  { key: "transfer_in", label: "Received" },
  { key: "bonus", label: "Bonus" },
  { key: "hackathon_fee", label: "Hackathon" },
];

const PAGE_SIZE = 20;

export default function Transactions() {
  const [activeFilter, setActiveFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const { data: transactions = [], isLoading } = useTransactions(undefined, activeFilter);

  const searchFiltered = transactions.filter((transaction: any) =>
    searchTerm
      ? transaction.description?.toLowerCase().includes(searchTerm.toLowerCase())
      : true
  );

  const filteredTransactions = searchFiltered.filter((t: any) => {
    const txDate = new Date(t.created_at).toISOString().split("T")[0];
    if (dateFrom && txDate < dateFrom) return false;
    if (dateTo && txDate > dateTo) return false;
    return true;
  });

  const paginatedTransactions = filteredTransactions.slice(0, visibleCount);
  const hasMore = visibleCount < filteredTransactions.length;

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
        className="mb-4"
      >
        <h1 className="text-2xl font-bold text-foreground mb-2">
          Transaction History
        </h1>
        <p className="text-muted-foreground">
          View all your Dreamers Coin activities
        </p>
      </motion.div>

      {/* Search input */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.03 }}
        className="mb-3"
      >
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search transactions..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setVisibleCount(PAGE_SIZE);
            }}
            className="pl-9 bg-secondary border-border"
          />
        </div>
      </motion.div>

      {/* Date range filter */}
      <div className="flex gap-2 mb-3">
        <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="bg-secondary border-border text-xs h-8 flex-1" placeholder="From" />
        <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="bg-secondary border-border text-xs h-8 flex-1" placeholder="To" />
        {(dateFrom || dateTo) && (
          <Button size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={() => { setDateFrom(""); setDateTo(""); }}>Clear</Button>
        )}
      </div>

      {/* Filter chips */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="mb-4 overflow-x-auto scrollbar-hide"
      >
        <div className="flex gap-2 pb-2">
          {FILTERS.map((filter) => (
            <Button
              key={filter.key}
              size="sm"
              variant={activeFilter === filter.key ? "default" : "outline"}
              className={cn(
                "whitespace-nowrap text-xs h-8",
                activeFilter === filter.key
                  ? "bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:text-foreground"
              )}
              onClick={() => {
                setActiveFilter(filter.key);
                setVisibleCount(PAGE_SIZE);
              }}
            >
              {filter.label}
            </Button>
          ))}
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        {isLoading ? (
          <SkeletonList count={5} />
        ) : filteredTransactions.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            {searchTerm
              ? "No transactions matching your search."
              : activeFilter === "all"
                ? "No transactions yet. Earn DR through activities and daily check-ins!"
                : `No ${FILTERS.find(f => f.key === activeFilter)?.label.toLowerCase()} transactions.`}
          </p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground mb-3">
              {filteredTransactions.length} transaction{filteredTransactions.length !== 1 ? "s" : ""}
              {searchTerm && ` matching "${searchTerm}"`}
            </p>
            <TransactionList transactions={paginatedTransactions} showAll />
            {hasMore && (
              <div className="flex justify-center mt-4">
                <Button
                  variant="outline"
                  className="border-primary/30 text-primary hover:bg-primary/10"
                  onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
                >
                  Load More ({filteredTransactions.length - visibleCount} remaining)
                </Button>
              </div>
            )}
          </>
        )}
      </motion.div>
    </motion.div>
  );
}
