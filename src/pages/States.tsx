import { useState } from "react";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useStateRankings, useStates, useJoinState } from "@/hooks/useSupabase";
import { useUser } from "@/contexts/UserContext";
import { useToast } from "@/hooks/use-toast";
import { MapPin, Users, Trophy, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const rankColors = ["text-yellow-400", "text-gray-300", "text-amber-600"];
const rankBgs = ["bg-yellow-400/20", "bg-gray-300/20", "bg-amber-600/20"];

export default function States() {
  const { data: rankings = [], isLoading } = useStateRankings();
  const { data: states = [] } = useStates();
  const joinMutation = useJoinState();
  const { dbUser } = useUser();
  const { toast } = useToast();
  const [confirmState, setConfirmState] = useState<{ id: string; name: string } | null>(null);

  const myState = rankings.find((s: any) => s.state_id === dbUser?.state_id);
  const hasJoined = !!dbUser?.state_id;

  const handleJoin = async () => {
    if (!confirmState) return;
    try {
      const result = await joinMutation.mutateAsync(confirmState.id);
      if (result?.success) {
        toast({ title: `Joined ${result.state}!`, description: "You're now representing your state." });
      } else {
        toast({ title: "Error", description: result?.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to join state.", variant: "destructive" });
    }
    setConfirmState(null);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="pb-28 px-4 pt-6"
    >
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <h1 className="text-2xl font-bold text-foreground mb-2">State Rankings</h1>
        <p className="text-muted-foreground">Represent your state in the Dreamers community</p>
      </motion.div>

      {/* Your State card */}
      {hasJoined && myState && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="gradient-card border-primary/30 p-4 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <span className="text-primary font-bold">#{myState.rank}</span>
                </div>
                <div>
                  <p className="font-medium text-foreground">{myState.state_name}</p>
                  <p className="text-xs text-muted-foreground">Your State</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-primary font-bold">{Number(myState.total_balance).toLocaleString()} DR</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
                  <Users className="w-3 h-3" />{Number(myState.member_count)} members
                </p>
              </div>
            </div>
          </Card>
        </motion.div>
      )}

      {/* Join prompt */}
      {!hasJoined && !isLoading && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="gradient-card border-border/50 p-4 mb-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
                <MapPin className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-medium text-foreground">Join Your State</p>
                <p className="text-xs text-muted-foreground">Select your state below to start representing</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {states.map((state: any) => (
                <Button
                  key={state.id}
                  variant="outline"
                  size="sm"
                  className="border-border hover:border-primary hover:bg-primary/10 text-sm"
                  onClick={() => setConfirmState({ id: state.id, name: state.name })}
                  disabled={joinMutation.isPending}
                >
                  {state.name}
                </Button>
              ))}
            </div>
          </Card>
        </motion.div>
      )}

      {/* Rankings list */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : rankings.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No states yet.</p>
      ) : (
        <div className="space-y-2">
          {rankings.map((state: any, index: number) => {
            const isMyState = state.state_id === dbUser?.state_id;
            return (
              <motion.div
                key={state.state_id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + index * 0.05 }}
              >
                <Card className={cn("gradient-card border-border/50 p-3", isMyState && "border-primary/30 bg-primary/5")}>
                  <div className="flex items-center gap-3">
                    <span className={cn(
                      "w-8 text-center font-bold text-sm",
                      index < 3 ? rankColors[index] : "text-muted-foreground"
                    )}>
                      #{state.rank}
                    </span>
                    <div className={cn(
                      "w-9 h-9 rounded-full flex items-center justify-center",
                      index < 3 ? rankBgs[index] : "bg-muted"
                    )}>
                      {index === 0 ? (
                        <Trophy className="w-4 h-4 text-yellow-400" />
                      ) : (
                        <MapPin className={cn("w-4 h-4", index < 3 ? rankColors[index] : "text-muted-foreground")} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground text-sm truncate">
                        {state.state_name}
                        {isMyState && <span className="text-primary ml-1">(You)</span>}
                      </p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Users className="w-3 h-3" />{Number(state.member_count)} members
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-primary font-bold text-sm">{Number(state.total_balance).toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">DR</p>
                    </div>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Confirmation dialog */}
      <AlertDialog open={!!confirmState} onOpenChange={(open) => !open && setConfirmState(null)}>
        <AlertDialogContent className="bg-background border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Join {confirmState?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This is permanent and cannot be changed. You will represent {confirmState?.name} in all state rankings.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
              onClick={handleJoin}
              disabled={joinMutation.isPending}
            >
              {joinMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}
