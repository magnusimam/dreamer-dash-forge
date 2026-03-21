import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useLeaderboard } from "@/hooks/useSupabase";
import { useUser } from "@/contexts/UserContext";
import { Trophy, TrendingUp, Flame, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const rankColors = ["text-yellow-400", "text-gray-300", "text-amber-600"];
const rankBgs = ["bg-yellow-400/20", "bg-gray-300/20", "bg-amber-600/20"];

export default function Leaderboard() {
  const { data: leaderboard = [], isLoading } = useLeaderboard(50);
  const { dbUser } = useUser();

  const myRank = leaderboard.find((u: any) => u.user_id === dbUser?.id);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="pb-20 px-4 pt-6"
    >
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <h1 className="text-2xl font-bold text-foreground mb-2">Leaderboard</h1>
        <p className="text-muted-foreground">Top earners in the Dreamers community</p>
      </motion.div>

      {/* Your rank */}
      {myRank && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="gradient-card border-primary/30 p-4 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <span className="text-primary font-bold">#{myRank.rank}</span>
                </div>
                <div>
                  <p className="font-medium text-foreground">Your Rank</p>
                  <p className="text-xs text-muted-foreground">{myRank.total_earned.toLocaleString()} DR earned</p>
                </div>
              </div>
              <Badge className="bg-primary/20 text-primary border-primary/30">
                <TrendingUp className="w-3 h-3 mr-1" />
                {myRank.status}
              </Badge>
            </div>
          </Card>
        </motion.div>
      )}

      {/* Top 3 podium */}
      {!isLoading && leaderboard.length >= 3 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="flex items-end justify-center gap-3 mb-6">
          {[1, 0, 2].map((idx) => {
            const user = leaderboard[idx] as any;
            if (!user) return null;
            const isFirst = idx === 0;
            const initials = [user.first_name?.[0], user.last_name?.[0]].filter(Boolean).join("");
            return (
              <div key={user.user_id} className={cn("flex flex-col items-center", isFirst ? "order-2" : idx === 1 ? "order-1" : "order-3")}>
                <Trophy className={cn("w-5 h-5 mb-1", rankColors[idx])} />
                <Avatar className={cn("mb-2 border-2", isFirst ? "w-16 h-16 border-yellow-400" : "w-12 h-12 border-border")}>
                  <AvatarImage src={user.photo_url} />
                  <AvatarFallback className={cn("text-sm", rankBgs[idx])}>{initials || "?"}</AvatarFallback>
                </Avatar>
                <p className="text-xs font-medium text-foreground text-center truncate max-w-[80px]">
                  {user.first_name}
                </p>
                <p className="text-xs text-primary font-semibold">{user.total_earned.toLocaleString()}</p>
                <div className={cn("w-full rounded-t-lg mt-1", rankBgs[idx], isFirst ? "h-16" : idx === 1 ? "h-12" : "h-10", "min-w-[70px] flex items-center justify-center")}>
                  <span className={cn("font-bold text-lg", rankColors[idx])}>#{idx + 1}</span>
                </div>
              </div>
            );
          })}
        </motion.div>
      )}

      {/* Full list */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : leaderboard.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No users yet.</p>
      ) : (
        <div className="space-y-2">
          {leaderboard.map((user: any, index: number) => {
            const initials = [user.first_name?.[0], user.last_name?.[0]].filter(Boolean).join("");
            const isMe = user.user_id === dbUser?.id;
            return (
              <motion.div
                key={user.user_id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + index * 0.03 }}
              >
                <Card className={cn("gradient-card border-border/50 p-3", isMe && "border-primary/30 bg-primary/5")}>
                  <div className="flex items-center gap-3">
                    <span className={cn(
                      "w-8 text-center font-bold text-sm",
                      index < 3 ? rankColors[index] : "text-muted-foreground"
                    )}>
                      #{user.rank}
                    </span>
                    <Avatar className="w-9 h-9">
                      <AvatarImage src={user.photo_url} />
                      <AvatarFallback className="text-xs">{initials || "?"}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground text-sm truncate">
                        {[user.first_name, user.last_name].filter(Boolean).join(" ")}
                        {isMe && <span className="text-primary ml-1">(You)</span>}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {user.streak > 0 && (
                          <span className="flex items-center gap-0.5">
                            <Flame className="w-3 h-3 text-orange-400" />{user.streak}
                          </span>
                        )}
                        <span>{user.status}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-primary font-bold text-sm">{user.total_earned.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">DR earned</p>
                    </div>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
