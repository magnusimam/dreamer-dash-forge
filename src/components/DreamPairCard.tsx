import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useMyPair, useIsInQueue, useJoinPairQueue, useRatePair, useRequestPairExtension, useAcceptPairExtension, useDenyPairExtension, useCheckinForPair, isUserOnline, formatLastSeen } from "@/hooks/useSupabase";
import { useUser } from "@/contexts/UserContext";
import { Heart, Star, X, Loader2, CheckCircle, UserPlus, Bell, Clock } from "lucide-react";
import { hapticNotification } from "@/lib/telegram";
import { notifyUser } from "@/lib/notifications";

interface Props {
  onViewProfile?: (userId: string) => void;
}

export default function DreamPairCard({ onViewProfile }: Props) {
  const { toast } = useToast();
  const { dbUser } = useUser();
  const { data: myPair, isLoading } = useMyPair();
  const { data: inQueue } = useIsInQueue();
  const joinQueueMutation = useJoinPairQueue();
  const rateMutation = useRatePair();
  const requestExtensionMutation = useRequestPairExtension();
  const acceptExtensionMutation = useAcceptPairExtension();
  const denyExtensionMutation = useDenyPairExtension();
  const checkinForPartnerMutation = useCheckinForPair();

  const [showRating, setShowRating] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");

  if (isLoading) return null;

  // Not paired, not in queue — show "Find a pair" button
  if (!myPair && !inQueue) {
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-4">
        <Card className="border-pink-500/20 bg-pink-500/5 p-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-pink-500/15 flex items-center justify-center">
              <Heart className="w-4 h-4 text-pink-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">Dream Pair</p>
              <p className="text-xs text-muted-foreground">Get paired with another Dreamer to help each other grow</p>
            </div>
            <Button size="sm" className="bg-pink-600 hover:bg-pink-700 text-white h-8"
              disabled={joinQueueMutation.isPending}
              onClick={async () => {
                try {
                  const result = await joinQueueMutation.mutateAsync();
                  if (result?.success) {
                    if (result.paired) {
                      hapticNotification("success");
                      toast({ title: "You've been paired!", description: "Check out your new partner" });
                    } else {
                      toast({ title: "Queued!", description: "You'll be paired as soon as someone else joins" });
                    }
                  }
                } catch (err: any) {
                  toast({ title: "Error", description: err?.message, variant: "destructive" });
                }
              }}>
              {joinQueueMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserPlus className="w-3 h-3 mr-1" />}
              Pair Me
            </Button>
          </div>
        </Card>
      </motion.div>
    );
  }

  // In queue, waiting for pair
  if (!myPair && inQueue) {
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-4">
        <Card className="border-border/50 p-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
              <Clock className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">Looking for a pair...</p>
              <p className="text-xs text-muted-foreground">You'll be paired when another Dreamer joins the queue</p>
            </div>
          </div>
        </Card>
      </motion.div>
    );
  }

  if (!myPair) return null;

  const partner = myPair.partner as any;
  const weekEnd = new Date(myPair.week_end);
  const daysLeft = Math.max(0, Math.ceil((weekEnd.getTime() - Date.now()) / 86400000));
  const weekEndedForRating = daysLeft === 0 && !myPair.i_rated;

  const handlePoke = () => {
    if (partner?.telegram_id) {
      notifyUser(partner.telegram_id, `👋 <b>${dbUser?.first_name} poked you!</b>\n\nYour Dream Pair is reminding you to check in. Open the app and claim your daily reward!`);
    }
    hapticNotification("success");
    toast({ title: "Poke sent!", description: `${partner?.first_name} has been notified` });
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-4">
      <Card className="border-pink-500/20 bg-gradient-to-r from-pink-500/10 to-purple-500/10 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Heart className="w-4 h-4 text-pink-400" />
          <p className="text-xs font-medium text-pink-400 uppercase tracking-wider">Dream Pair</p>
          <Badge variant="outline" className="text-[10px] ml-auto">{daysLeft}d left</Badge>
        </div>

        <button className="w-full flex items-center gap-3 mb-3" onClick={() => onViewProfile && partner?.id && onViewProfile(partner.id)}>
          <div className="relative">
            <Avatar className="w-12 h-12 border-2 border-pink-400/50">
              <AvatarImage src={partner?.photo_url} />
              <AvatarFallback>{partner?.first_name?.[0]}</AvatarFallback>
            </Avatar>
            <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-card ${isUserOnline(partner?.last_active) ? "bg-emerald-400" : "bg-muted-foreground/30"}`} />
          </div>
          <div className="flex-1 text-left">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold text-foreground">{partner?.first_name} {partner?.last_name || ""}</p>
              {myPair.partner_checked_in_today ? (
                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[9px]">✓ Checked in today</Badge>
              ) : (
                <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 text-[9px]">Not checked in</Badge>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground">{myPair.partner_activities_this_week} activities this week</p>
            {partner?.username && <p className="text-[10px] text-muted-foreground">@{partner.username}</p>}
            <p className="text-[10px] text-muted-foreground">
              {partner?.streak || 0} day streak · {partner?.status}
              {!isUserOnline(partner?.last_active) && partner?.last_active && ` · ${formatLastSeen(partner.last_active)}`}
            </p>
          </div>
        </button>

        {/* Show rating received from partner */}
        {myPair.partner_rated_me && (
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-2 mb-3 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-foreground font-medium">{partner?.first_name} rated you:</span>
              <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star key={n} className={`w-3.5 h-3.5 ${n <= (myPair.rating_i_received || 0) ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`} />
                ))}
              </div>
            </div>
            <span className="text-xs text-primary font-medium">+{(myPair.rating_i_received || 0) * 10} DR</span>
          </div>
        )}

        {weekEndedForRating ? (
          <Button className="w-full bg-yellow-500 hover:bg-yellow-600 text-white" onClick={() => setShowRating(true)}>
            <Star className="w-4 h-4 mr-2" /> Rate Your Partner
          </Button>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <Button size="sm" variant="outline" className="border-pink-500/30 text-pink-400" onClick={handlePoke}>
              <Bell className="w-3.5 h-3.5 mr-1.5" /> Poke
            </Button>
            <Button size="sm" variant="outline" className={myPair.partner_checked_in_today ? "border-emerald-500/30 text-emerald-400 cursor-not-allowed" : "border-emerald-500/30 text-emerald-400"}
              disabled={myPair.partner_checked_in_today || myPair.my_checked_for_partner || checkinForPartnerMutation.isPending}
              onClick={async () => {
                try {
                  const result = await checkinForPartnerMutation.mutateAsync(myPair.id);
                  if (result?.success) {
                    hapticNotification("success");
                    toast({ title: "Checked in for your pair!", description: `${result.partner_name} earned ${result.reward} DR` });
                    if (result.partner_telegram_id) {
                      notifyUser(result.partner_telegram_id, `💫 <b>${dbUser?.first_name} checked in for you!</b>\n\nYour Dream Pair claimed your daily check-in. You got +${result.reward} DR! 🎉`);
                    }
                  } else {
                    toast({ title: "Failed", description: result?.error, variant: "destructive" });
                  }
                } catch (err: any) {
                  toast({ title: "Error", description: err?.message, variant: "destructive" });
                }
              }}>
              {checkinForPartnerMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5 mr-1.5" />}
              {myPair.partner_checked_in_today ? "Checked in" : myPair.my_checked_for_partner ? "Done" : "Check in"}
            </Button>
          </div>
        )}

        {/* Extension Flow */}
        {daysLeft <= 1 && myPair.i_rated && !myPair.extension_status && (
          <Button size="sm" variant="outline" className="w-full mt-2 border-primary/30 text-primary"
            disabled={requestExtensionMutation.isPending}
            onClick={async () => {
              const result = await requestExtensionMutation.mutateAsync(myPair.id);
              if (result?.success) {
                toast({ title: "Extension Requested!", description: `Waiting for ${partner?.first_name} to accept. Both pay 100 DR.` });
                if (partner?.telegram_id) {
                  notifyUser(partner.telegram_id, `💫 <b>Pair Extension Request!</b>\n\n<b>${dbUser?.first_name}</b> wants to keep you as their Dream Pair for next week.\n\nBoth of you will pay 100 DR. Open the app to accept or deny!`);
                }
              } else {
                toast({ title: "Failed", description: result?.error, variant: "destructive" });
              }
            }}>
            {requestExtensionMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Heart className="w-3 h-3 mr-1" />}
            Request Extension (100 DR each)
          </Button>
        )}

        {myPair.i_requested_extension && myPair.extension_status === "pending" && (
          <div className="mt-2 bg-primary/10 border border-primary/20 rounded-lg p-2 text-center">
            <p className="text-xs text-primary font-medium">Extension requested — waiting for {partner?.first_name}</p>
          </div>
        )}

        {myPair.partner_requested_extension && myPair.extension_status === "pending" && (
          <div className="mt-2 space-y-2">
            <div className="bg-primary/10 border border-primary/20 rounded-lg p-2 text-center">
              <p className="text-xs text-foreground font-medium">{partner?.first_name} wants to keep you as their pair!</p>
              <p className="text-[10px] text-muted-foreground">Both of you will pay 100 DR</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white"
                disabled={acceptExtensionMutation.isPending || (dbUser?.balance ?? 0) < 100}
                onClick={async () => {
                  const result = await acceptExtensionMutation.mutateAsync(myPair.id);
                  if (result?.success) {
                    hapticNotification("success");
                    toast({ title: "Pair Extended!", description: "You'll stay together next week" });
                    if (partner?.telegram_id) {
                      notifyUser(partner.telegram_id, `✅ <b>${dbUser?.first_name} accepted!</b>\n\nYou'll stay paired for next week. 100 DR deducted from both.`);
                    }
                  } else {
                    toast({ title: "Failed", description: result?.error, variant: "destructive" });
                  }
                }}>
                {acceptExtensionMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3 mr-1" />}
                Accept
              </Button>
              <Button size="sm" variant="outline" className="border-destructive/30 text-destructive"
                disabled={denyExtensionMutation.isPending}
                onClick={async () => {
                  await denyExtensionMutation.mutateAsync(myPair.id);
                  toast({ title: "Extension Denied", description: "You'll be reshuffled next week" });
                  if (partner?.telegram_id) {
                    notifyUser(partner.telegram_id, `${dbUser?.first_name} declined the extension. You'll both be reshuffled next week.`);
                  }
                }}>
                {denyExtensionMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                Deny
              </Button>
            </div>
          </div>
        )}

        {myPair.extension_status === "accepted" && (
          <div className="mt-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-2 text-center">
            <p className="text-xs text-emerald-400 font-medium">Extended for next week!</p>
          </div>
        )}

        {myPair.extension_status === "denied" && (
          <div className="mt-2 bg-muted/50 border border-border rounded-lg p-2 text-center">
            <p className="text-xs text-muted-foreground">Extension denied — reshuffling next week</p>
          </div>
        )}
      </Card>

      {/* Rating Modal */}
      <AnimatePresence>
        {showRating && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-end justify-center" onClick={() => setShowRating(false)}>
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25 }} className="w-full max-w-md bg-card border-t border-border rounded-t-2xl p-6 pb-16" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-foreground text-lg">Rate {partner?.first_name}</h3>
                <Button size="icon" variant="ghost" onClick={() => setShowRating(false)}><X className="w-4 h-4" /></Button>
              </div>
              <p className="text-xs text-muted-foreground mb-4">How helpful and active was your Dream Pair this week?</p>

              <div className="flex justify-center gap-2 mb-4">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} onClick={() => setRating(n)} className="transition-transform hover:scale-110">
                    <Star className={`w-10 h-10 ${n <= rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`} />
                  </button>
                ))}
              </div>

              <Input placeholder="Optional comment" value={comment} onChange={(e) => setComment(e.target.value)} className="mb-4 bg-secondary border-border" />

              <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground" disabled={rating === 0 || rateMutation.isPending}
                onClick={async () => {
                  try {
                    const result = await rateMutation.mutateAsync({ pairId: myPair.id, rating, comment });
                    if (result?.success) {
                      hapticNotification("success");
                      toast({ title: "Rating submitted!", description: `${partner?.first_name} earned ${result.reward} DR` });
                      if (partner?.telegram_id) {
                        notifyUser(partner.telegram_id, `⭐ <b>You got a rating!</b>\n\n${dbUser?.first_name} rated you ${rating}/5 stars as their Dream Pair.\n\n+${result.reward} DR added to your balance!`);
                      }
                      setShowRating(false);
                      setRating(0);
                      setComment("");
                    } else {
                      toast({ title: "Failed", description: result?.error, variant: "destructive" });
                    }
                  } catch (err: any) {
                    toast({ title: "Error", description: err?.message, variant: "destructive" });
                  }
                }}>
                {rateMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Star className="w-4 h-4 mr-2" />}
                Submit Rating
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
