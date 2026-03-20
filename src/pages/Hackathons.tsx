import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { mockHackathons, type Hackathon } from "@/data/mockData";
import {
  CalendarDays,
  Users,
  Trophy,
  Coins,
  Rocket,
  CheckCircle,
  X,
  Clock,
} from "lucide-react";

interface HackathonsProps {
  balance: number;
  onUpdateBalance: (amount: number) => void;
}

const statusStyles: Record<Hackathon["status"], string> = {
  upcoming: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  active: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  completed: "bg-muted text-muted-foreground border-border",
};

export default function Hackathons({ balance, onUpdateBalance }: HackathonsProps) {
  const { toast } = useToast();
  const [hackathons] = useState(mockHackathons);
  const [registeredIds, setRegisteredIds] = useState<string[]>([]);
  const [selectedHackathon, setSelectedHackathon] = useState<Hackathon | null>(null);

  const handleRegister = () => {
    if (!selectedHackathon) return;

    if (balance < selectedHackathon.entryFee) {
      toast({
        title: "Insufficient Dreams",
        description: `You need ${selectedHackathon.entryFee} DR to register. Earn more by completing activities!`,
        variant: "destructive",
      });
      return;
    }

    if (selectedHackathon.registeredTeams >= selectedHackathon.maxTeams) {
      toast({
        title: "Registration Full",
        description: "This hackathon has reached maximum capacity.",
        variant: "destructive",
      });
      return;
    }

    setRegisteredIds((prev) => [...prev, selectedHackathon.id]);
    onUpdateBalance(-selectedHackathon.entryFee);
    toast({
      title: "Registered! 🚀",
      description: `You're in for "${selectedHackathon.title}". ${selectedHackathon.entryFee} DR deducted.`,
    });
    setSelectedHackathon(null);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="pb-20 px-4 pt-6"
    >
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <h1 className="text-2xl font-bold text-foreground mb-2">
          Hackathons 🚀
        </h1>
        <p className="text-muted-foreground">
          Register for hackathons using your earned Dreams
        </p>
      </motion.div>

      {/* Balance reminder */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mb-6"
      >
        <Card className="gradient-card border-border/50 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
            <Coins className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Available Balance</p>
            <p className="text-lg font-bold text-primary">
              {balance.toLocaleString()} DR
            </p>
          </div>
        </Card>
      </motion.div>

      {/* Hackathon list */}
      <div className="space-y-4">
        {hackathons.map((hackathon, index) => {
          const isRegistered = registeredIds.includes(hackathon.id);
          const isFull = hackathon.registeredTeams >= hackathon.maxTeams;

          return (
            <motion.div
              key={hackathon.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + index * 0.08 }}
            >
              <Card className="gradient-card border-border/50 p-5">
                <div className="flex items-start justify-between mb-3">
                  <Badge
                    variant="outline"
                    className={statusStyles[hackathon.status]}
                  >
                    {hackathon.status}
                  </Badge>
                  <div className="flex items-center gap-1 text-primary font-semibold text-sm">
                    <Coins className="w-3.5 h-3.5" />
                    {hackathon.entryFee} DR
                  </div>
                </div>

                <h3 className="text-lg font-semibold text-foreground mb-2">
                  {hackathon.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                  {hackathon.description}
                </p>

                <div className="flex flex-wrap gap-1.5 mb-4">
                  {hackathon.tags.map((tag) => (
                    <Badge
                      key={tag}
                      variant="secondary"
                      className="text-xs"
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>

                <div className="flex items-center gap-4 text-xs text-muted-foreground mb-4">
                  <span className="flex items-center gap-1">
                    <CalendarDays className="w-3.5 h-3.5" />
                    {new Date(hackathon.startDate).toLocaleDateString("en-NG", {
                      month: "short",
                      day: "numeric",
                    })}{" "}
                    –{" "}
                    {new Date(hackathon.endDate).toLocaleDateString("en-NG", {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" />
                    {hackathon.registeredTeams}/{hackathon.maxTeams} teams
                  </span>
                  <span className="flex items-center gap-1">
                    <Trophy className="w-3.5 h-3.5 text-primary" />
                    {hackathon.prize}
                  </span>
                </div>

                {hackathon.status === "completed" ? (
                  <Badge className="bg-muted text-muted-foreground">
                    <Clock className="w-3 h-3 mr-1" />
                    Ended
                  </Badge>
                ) : isRegistered ? (
                  <Badge className="bg-primary/20 text-primary border-primary/30">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Registered
                  </Badge>
                ) : (
                  <Button
                    size="sm"
                    disabled={isFull}
                    onClick={() => setSelectedHackathon(hackathon)}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-glow"
                  >
                    <Rocket className="w-3 h-3 mr-1" />
                    {isFull ? "Full" : "Register"}
                  </Button>
                )}
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Registration confirmation modal */}
      <AnimatePresence>
        {selectedHackathon && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end justify-center"
            onClick={() => setSelectedHackathon(null)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="w-full max-w-md bg-card border-t border-border rounded-t-2xl p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-foreground text-lg">
                  Confirm Registration
                </h3>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setSelectedHackathon(null)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <p className="text-foreground font-medium mb-1">
                {selectedHackathon.title}
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                {new Date(selectedHackathon.startDate).toLocaleDateString()} –{" "}
                {new Date(selectedHackathon.endDate).toLocaleDateString()}
              </p>

              <div className="gradient-card border border-border/50 rounded-lg p-4 mb-4">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-muted-foreground">Entry Fee</span>
                  <span className="text-primary font-semibold">
                    {selectedHackathon.entryFee} DR
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-muted-foreground">Your Balance</span>
                  <span className="text-foreground font-semibold">
                    {balance.toLocaleString()} DR
                  </span>
                </div>
                <div className="border-t border-border/50 pt-2 mt-2 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">After Registration</span>
                  <span
                    className={
                      balance >= selectedHackathon.entryFee
                        ? "text-foreground font-semibold"
                        : "text-destructive font-semibold"
                    }
                  >
                    {(balance - selectedHackathon.entryFee).toLocaleString()} DR
                  </span>
                </div>
              </div>

              <Button
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-glow"
                onClick={handleRegister}
                disabled={balance < selectedHackathon.entryFee}
              >
                <Rocket className="w-4 h-4 mr-2" />
                {balance < selectedHackathon.entryFee
                  ? "Insufficient Dreams"
                  : "Confirm & Pay"}
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
