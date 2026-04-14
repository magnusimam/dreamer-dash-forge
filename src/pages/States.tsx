import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import UserProfileModal from "@/components/UserProfileModal";
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
import { useStateRankings, useStates, useJoinState, useLeaveState, useStateMembers } from "@/hooks/useSupabase";
import { useUser } from "@/contexts/UserContext";
import { useToast } from "@/hooks/use-toast";
import { MapPin, Users, Trophy, Loader2, X, Award, Coins } from "lucide-react";
import { cn } from "@/lib/utils";

const rankColors = ["text-yellow-400", "text-gray-300", "text-amber-600"];
const rankBgs = ["bg-yellow-400/20", "bg-gray-300/20", "bg-amber-600/20"];

export default function States() {
  const { data: rankings = [], isLoading } = useStateRankings();
  const { data: states = [] } = useStates();
  const joinMutation = useJoinState();
  const leaveMutation = useLeaveState();
  const { dbUser } = useUser();
  const { toast } = useToast();
  const [confirmState, setConfirmState] = useState<{ id: string; name: string } | null>(null);
  const [selectedState, setSelectedState] = useState<{ id: string; name: string; member_count: number; total_balance: number; rank: number } | null>(null);
  const { data: stateMembers = [], isLoading: membersLoading } = useStateMembers(selectedState?.id ?? null);
  const [viewProfileUserId, setViewProfileUserId] = useState<string | null>(null);

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
            <div className="flex items-center justify-between mb-3">
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
            <Button
              size="sm"
              variant="outline"
              className="w-full border-destructive/30 text-destructive hover:bg-destructive/10 h-8 text-xs"
              disabled={leaveMutation.isPending}
              onClick={async () => {
                try {
                  const result = await leaveMutation.mutateAsync();
                  if (result?.success) {
                    toast({ title: "Left state", description: "You can now join another state" });
                  }
                } catch (err: any) {
                  toast({ title: "Error", description: err?.message, variant: "destructive" });
                }
              }}
            >
              {leaveMutation.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : null}
              Leave State
            </Button>
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
                <Card
                  className={cn("gradient-card border-border/50 p-3 cursor-pointer active:scale-[0.98] transition-transform", isMyState && "border-primary/30 bg-primary/5")}
                  onClick={() => setSelectedState({
                    id: state.state_id,
                    name: state.state_name,
                    member_count: Number(state.member_count),
                    total_balance: Number(state.total_balance),
                    rank: state.rank,
                  })}
                >
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

      {/* State Members Bottom Sheet */}
      <AnimatePresence>
        {selectedState && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-end justify-center"
            onClick={() => setSelectedState(null)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="w-full max-w-md bg-card border-t border-border rounded-t-2xl p-5 pb-10 max-h-[80vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
              drag="y"
              dragConstraints={{ top: 0 }}
              dragElastic={0.2}
              onDragEnd={(_, info) => {
                if (info.offset.y > 100) setSelectedState(null);
              }}
            >
              {/* Handle */}
              <div className="w-10 h-1 bg-border rounded-full mx-auto mb-4" />

              {/* Header */}
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold text-foreground text-lg">{selectedState.name}</h3>
                </div>
                <button
                  onClick={() => setSelectedState(null)}
                  className="p-1 rounded-full hover:bg-muted"
                >
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>

              {/* State stats */}
              <div className="flex items-center gap-4 mb-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Trophy className="w-3 h-3" /> Rank #{selectedState.rank}
                </span>
                <span className="flex items-center gap-1">
                  <Users className="w-3 h-3" /> {selectedState.member_count} members
                </span>
                <span className="flex items-center gap-1">
                  <Coins className="w-3 h-3" /> {selectedState.total_balance.toLocaleString()} DR
                </span>
              </div>

              {/* Members list */}
              <div className="overflow-y-auto flex-1 -mx-1 px-1">
                {membersLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  </div>
                ) : stateMembers.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No members yet.</p>
                ) : (
                  <div className="space-y-2">
                    {stateMembers.map((member: any, i: number) => {
                      const name = [member.first_name, member.last_name].filter(Boolean).join(" ");
                      const initials = [member.first_name?.[0], member.last_name?.[0]].filter(Boolean).join("");
                      const isMe = member.id === dbUser?.id;
                      const tierColors: Record<string, string> = {
                        Bronze: "bg-amber-700/20 text-amber-500 border-amber-700/30",
                        Silver: "bg-gray-300/20 text-gray-300 border-gray-300/30",
                        Gold: "bg-primary/20 text-primary border-primary/30",
                        Diamond: "bg-cyan-400/20 text-cyan-400 border-cyan-400/30",
                      };
                      return (
                        <div
                          key={member.id}
                          className={cn(
                            "flex items-center gap-3 p-2.5 rounded-lg",
                            isMe ? "bg-primary/10 border border-primary/20" : "bg-secondary/30"
                          )}
                        >
                          <span className={cn(
                            "w-6 text-center font-bold text-xs",
                            i === 0 ? "text-yellow-400" : i === 1 ? "text-gray-300" : i === 2 ? "text-amber-600" : "text-muted-foreground"
                          )}>
                            {i + 1}
                          </span>
                          <button className="relative" onClick={() => setViewProfileUserId(member.id)}>
                            <Avatar className="w-8 h-8">
                              <AvatarImage src={member.photo_url} />
                              <AvatarFallback className="bg-primary/20 text-primary text-xs">
                                {initials || "?"}
                              </AvatarFallback>
                            </Avatar>
                            <span className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-card ${member.last_active && new Date(member.last_active).getTime() > Date.now() - 300000 ? "bg-emerald-400" : "bg-muted-foreground/30"}`} />
                          </button>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">
                              {name}
                              {isMe && <span className="text-primary ml-1">(You)</span>}
                            </p>
                            {member.username && (
                              <p className="text-xs text-muted-foreground truncate">@{member.username}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge className={cn("text-[10px] px-1.5 py-0", tierColors[member.status] || tierColors.Bronze)}>
                              {member.status}
                            </Badge>
                            <div className="text-right">
                              <p className="text-xs font-bold text-primary">{Number(member.balance).toLocaleString()}</p>
                              <p className="text-[10px] text-muted-foreground">DR</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {viewProfileUserId && (
        <UserProfileModal
          userId={viewProfileUserId}
          onClose={() => setViewProfileUserId(null)}
        />
      )}
    </motion.div>
  );
}
