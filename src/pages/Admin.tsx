import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useActivities,
  useCreateActivity,
  useUpdateActivity,
  useDeleteActivity,
  useActivityParticipants,
  useHackathons,
  useCreateHackathon,
  useUpdateHackathon,
  useDeleteHackathon,
  useRedemptionRequests,
  useProcessRedemption,
  useAllUsers,
  useAdjustBalance,
  useDeleteUser,
  useRedemptionCategories,
  useUpdateRedemptionCategory,
  useAllMentors,
  useCreateMentor,
  useUpdateMentor,
  useDeleteMentor,
  useStates,
  useStateRankings,
  useCreateState,
  useDeleteState,
  useAllReferrals,
  useRaffles,
  useCreateRaffle,
  useDeleteRaffle,
  useDrawRaffleWinner,
  useRaffleEntries,
  useAllPromoCodes,
  useCreatePromoCode,
  useGeneratePromoCodes,
  useMissions,
  useCreateMission,
  useDeleteMission,
  useMissionParticipants,
} from "@/hooks/useSupabase";
import { useUser } from "@/contexts/UserContext";
import { supabase } from "@/lib/supabase";
import { uploadImage } from "@/lib/storage";
import { notifyRedemptionUpdate, notifyMentorshipApproved, notifyProofApproved, notifyProofRejected, notifyUser } from "@/lib/notifications";
import {
  Plus,
  Copy,
  CalendarDays,
  Users,
  Coins,
  KeyRound,
  Rocket,
  Trophy,
  Loader2,
  Trash2,
  Pencil,
  CheckCircle,
  XCircle,
  Clock,
  X,
  UserCog,
  Gift,
  ImageIcon,
  ShieldCheck,
  Send,
  Megaphone,
  Settings,
  MapPin,
  UserX,
  Ticket,
  Sparkles,
  Target,
  Lock,
} from "lucide-react";

const sanitize = (input: string) => input.replace(/<[^>]*>/g, "").trim();

function RaffleEntriesList({ raffleId }: { raffleId: string }) {
  const { data: entries = [], isLoading } = useRaffleEntries(raffleId);
  if (isLoading) return <p className="text-xs text-muted-foreground mt-2">Loading...</p>;
  if (entries.length === 0) return <p className="text-xs text-muted-foreground mt-2">No entries yet</p>;
  return (
    <div className="mt-3 space-y-1 pl-3 border-l-2 border-primary/20">
      {entries.map((e: any) => (
        <div key={e.id} className="flex items-center justify-between">
          <div>
            <p className="text-xs text-foreground">
              {[e.user?.first_name, e.user?.last_name].filter(Boolean).join(" ")}
            </p>
            {e.user?.username && <p className="text-[10px] text-muted-foreground">@{e.user.username}</p>}
          </div>
          <p className="text-[10px] text-muted-foreground/60">
            {new Date(e.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
          </p>
        </div>
      ))}
      <p className="text-[10px] text-muted-foreground">{entries.length} total entries</p>
    </div>
  );
}

function MissionParticipantsList({ missionId }: { missionId: string }) {
  const { data, isLoading } = useMissionParticipants(missionId);
  if (isLoading) return <p className="text-xs text-muted-foreground mt-2">Loading...</p>;
  if (!data || data.unlocked.length === 0) return <p className="text-xs text-muted-foreground mt-2">No one has unlocked this mission yet</p>;
  return (
    <div className="mt-3 space-y-1.5 pl-3 border-l-2 border-primary/20">
      {data.unlocked.map((u: any) => (
        <div key={u.id} className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div>
              <p className="text-xs text-foreground">
                {[u.user?.first_name, u.user?.last_name].filter(Boolean).join(" ")}
              </p>
              {u.user?.username && <p className="text-[10px] text-muted-foreground">@{u.user.username}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <p className="text-[10px] text-muted-foreground/60">
              {new Date(u.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
            </p>
            {u.completed ? (
              <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded px-1.5 py-0.5">Completed</span>
            ) : (
              <span className="text-[10px] bg-primary/20 text-primary border border-primary/30 rounded px-1.5 py-0.5">Unlocked</span>
            )}
          </div>
        </div>
      ))}
      <p className="text-[10px] text-muted-foreground">{data.unlocked.length} unlocked · {data.completed.length} completed</p>
    </div>
  );
}

function ActivityParticipantsList({ activityId }: { activityId: string }) {
  const { data: participants = [], isLoading } = useActivityParticipants(activityId);
  if (isLoading) return <p className="text-xs text-muted-foreground mt-2">Loading...</p>;
  if (participants.length === 0) return <p className="text-xs text-muted-foreground mt-2">No one has claimed this activity yet</p>;
  return (
    <div className="mt-3 space-y-1 pl-3 border-l-2 border-emerald-500/20">
      {participants.map((p: any) => (
        <div key={p.id} className="flex items-center justify-between">
          <div>
            <p className="text-xs text-foreground">
              {[p.user?.first_name, p.user?.last_name].filter(Boolean).join(" ")}
            </p>
            {p.user?.username && <p className="text-[10px] text-muted-foreground">@{p.user.username}</p>}
          </div>
          <p className="text-[10px] text-muted-foreground/60">
            {new Date(p.logged_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
          </p>
        </div>
      ))}
      <p className="text-[10px] text-emerald-400">{participants.length} claimed</p>
    </div>
  );
}

export default function Admin() {
  const { toast } = useToast();
  const { dbUser } = useUser();
  const queryClient = useQueryClient();

  // Data hooks
  const { data: activities = [] } = useActivities();
  const { data: hackathons = [] } = useHackathons();
  const { data: redemptions = [] } = useRedemptionRequests();
  const { data: allUsers = [] } = useAllUsers();

  const { data: redeemCategories = [] } = useRedemptionCategories();
  const { data: allMentors = [] } = useAllMentors();
  const { data: allStates = [] } = useStates();
  const { data: stateRankings = [] } = useStateRankings();
  const { data: allReferrals = [] } = useAllReferrals();
  const { data: raffles = [] } = useRaffles();
  const { data: promoCodes = [] } = useAllPromoCodes();
  const { data: allMissions = [] } = useMissions();

  // Pending proofs query
  const { data: pendingProofs = [] } = useQuery({
    queryKey: ["pending_proofs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity_logs")
        .select("*, activities(title, reward), users!activity_logs_user_id_fkey(first_name, last_name, username, telegram_id)")
        .eq("proof_status", "pending")
        .order("logged_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Mutation hooks
  const createActivityMutation = useCreateActivity();
  const updateActivityMutation = useUpdateActivity();
  const deleteActivityMutation = useDeleteActivity();
  const createHackathonMutation = useCreateHackathon();
  const updateHackathonMutation = useUpdateHackathon();
  const deleteHackathonMutation = useDeleteHackathon();
  const processRedemptionMutation = useProcessRedemption();
  const adjustBalanceMutation = useAdjustBalance();
  const deleteUserMutation = useDeleteUser();
  const updateCategoryMutation = useUpdateRedemptionCategory();
  const createMentorMutation = useCreateMentor();
  const updateMentorMutation = useUpdateMentor();
  const deleteMentorMutation = useDeleteMentor();
  const createStateMutation = useCreateState();
  const deleteStateMutation = useDeleteState();
  const createRaffleMutation = useCreateRaffle();
  const deleteRaffleMutation = useDeleteRaffle();
  const drawWinnerMutation = useDrawRaffleWinner();
  const createPromoCodeMutation = useCreatePromoCode();
  const generatePromoCodesMutation = useGeneratePromoCodes();
  const createMissionMutation = useCreateMission();
  const deleteMissionMutation = useDeleteMission();

  // Activity form
  const [actTitle, setActTitle] = useState("");
  const [actDesc, setActDesc] = useState("");
  const [actDate, setActDate] = useState("");
  const [actReward, setActReward] = useState("");
  const [actCategory, setActCategory] = useState("meeting");
  const [editingActivity, setEditingActivity] = useState<any | null>(null);
  const [actCodeRequired, setActCodeRequired] = useState(true);
  const [actProofRequired, setActProofRequired] = useState(false);
  const [actMaxParticipants, setActMaxParticipants] = useState("");

  // Hackathon form
  const [hackTitle, setHackTitle] = useState("");
  const [hackDesc, setHackDesc] = useState("");
  const [hackStart, setHackStart] = useState("");
  const [hackEnd, setHackEnd] = useState("");
  const [hackFee, setHackFee] = useState("");
  const [hackPrize, setHackPrize] = useState("");
  const [hackTeams, setHackTeams] = useState("");
  const [editingHackathon, setEditingHackathon] = useState<any | null>(null);
  const [hackCoverFile, setHackCoverFile] = useState<File | null>(null);

  // User balance adjustment modal
  const [adjustUser, setAdjustUser] = useState<any | null>(null);
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustReason, setAdjustReason] = useState("");

  // Mission form
  const [missionTitle, setMissionTitle] = useState("");
  const [missionDesc, setMissionDesc] = useState("");
  const [missionReward, setMissionReward] = useState("");
  const [missionUnlockFee, setMissionUnlockFee] = useState("");
  const [missionCode, setMissionCode] = useState("");
  const [missionExpiry, setMissionExpiry] = useState("");

  // Raffle form
  const [raffleTitle, setRaffleTitle] = useState("");
  const [raffleDesc, setRaffleDesc] = useState("");
  const [raffleFee, setRaffleFee] = useState("");
  const [raffleEnd, setRaffleEnd] = useState("");
  const [raffleMaxEntries, setRaffleMaxEntries] = useState("");
  const [viewingRaffleEntries, setViewingRaffleEntries] = useState<string | null>(null);
  const [viewingActivityParticipants, setViewingActivityParticipants] = useState<string | null>(null);
  const [viewingMissionParticipants, setViewingMissionParticipants] = useState<string | null>(null);

  // Promo code form
  const [promoCodeInput, setPromoCodeInput] = useState("");
  const [promoReward, setPromoReward] = useState("500");
  const [promoDesc, setPromoDesc] = useState("The Stolen Breath — Book Purchase Reward");
  const [promoBatchCount, setPromoBatchCount] = useState("5");

  // Delete user confirmation
  const [deleteUserTarget, setDeleteUserTarget] = useState<any | null>(null);


  // Redemption notes modal
  const [redeemAction, setRedeemAction] = useState<{ id: string; action: "approved" | "rejected" } | null>(null);
  const [redeemNotes, setRedeemNotes] = useState("");

  // Broadcast message
  const [broadcastMsg, setBroadcastMsg] = useState("");
  const [broadcastImg, setBroadcastImg] = useState<File | null>(null);
  const [broadcastImgUrl, setBroadcastImgUrl] = useState("");
  const [broadcasting, setBroadcasting] = useState(false);
  const [broadcastSent, setBroadcastSent] = useState(0);

  // DR calculator
  const [calcDR, setCalcDR] = useState("");

  // Redemption settings (editable costs)
  const [editingCosts, setEditingCosts] = useState<Record<string, string>>({});

  // Mentor form
  const [mentorName, setMentorName] = useState("");
  const [mentorSpecialty, setMentorSpecialty] = useState("");
  const [mentorContact, setMentorContact] = useState("");
  const [editingMentor, setEditingMentor] = useState<any | null>(null);

  // State form
  const [stateName, setStateName] = useState("");

  const generateCode = (title: string) => {
    const slug = title.toUpperCase().replace(/[^A-Z0-9 ]/g, "").split(" ").slice(0, 2).join("-");
    const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${slug}-${suffix}`;
  };

  // ---- STATE MANAGEMENT ----

  const handleCreateState = async () => {
    if (!stateName.trim()) {
      toast({ title: "Enter a state name", variant: "destructive" });
      return;
    }
    try {
      await createStateMutation.mutateAsync(sanitize(stateName));
      toast({ title: "State Created!" });
      setStateName("");
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Failed to create state.", variant: "destructive" });
    }
  };

  const handleDeleteState = async (stateId: string) => {
    try {
      const result = await deleteStateMutation.mutateAsync(stateId);
      if (result?.success) {
        toast({ title: "State Deleted" });
      } else {
        toast({ title: "Cannot Delete", description: result?.error, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Failed to delete state.", variant: "destructive" });
    }
  };

  // ---- BROADCAST TO ALL USERS ----

  const handleBroadcast = async () => {
    if (!broadcastMsg.trim() && !broadcastImg) {
      toast({ title: "Enter a message or add an image", variant: "destructive" });
      return;
    }
    setBroadcasting(true);
    setBroadcastSent(0);

    // Upload image if selected
    let photoUrl = broadcastImgUrl;
    if (broadcastImg && dbUser) {
      try {
        photoUrl = await uploadImage("hackathon-covers", broadcastImg, dbUser.id);
      } catch {
        toast({ title: "Image upload failed", variant: "destructive" });
        setBroadcasting(false);
        return;
      }
    }

    let sent = 0;
    for (const u of allUsers) {
      if (u.telegram_id && u.telegram_id !== 0) {
        notifyUser(u.telegram_id, broadcastMsg.trim(), photoUrl || undefined);
        sent++;
        setBroadcastSent(sent);
        await new Promise((r) => setTimeout(r, 50));
      }
    }
    setBroadcasting(false);
    setBroadcastMsg("");
    setBroadcastImg(null);
    setBroadcastImgUrl("");
    toast({ title: `Broadcast sent to ${sent} users` });
  };

  const broadcastNewActivity = (title: string, reward: number) => {
    for (const u of allUsers) {
      if (u.telegram_id && u.telegram_id !== 0) {
        notifyUser(
          u.telegram_id,
          `📢 <b>New Activity!</b>\n\n<b>${title}</b>\n+${reward} DR reward\n\nOpen the app to log your attendance!`
        );
      }
    }
  };

  const broadcastNewHackathon = (title: string, fee: number, prize: number) => {
    for (const u of allUsers) {
      if (u.telegram_id && u.telegram_id !== 0) {
        notifyUser(
          u.telegram_id,
          `🚀 <b>New Hackathon!</b>\n\n<b>${title}</b>\nEntry: ${fee} DR | Prize: ${prize} DR\n\nOpen the app to register!`
        );
      }
    }
  };

  const broadcastNewMission = (title: string, unlockFee: number, reward: number) => {
    for (const u of allUsers) {
      if (u.telegram_id && u.telegram_id !== 0) {
        notifyUser(
          u.telegram_id,
          `🎯 <b>New Mission!</b>\n\n<b>${title}</b>\nUnlock: ${unlockFee} DR | Reward: ${reward} DR\n\nOpen the app to start the mission!`
        );
      }
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({ title: "Copied!", description: code });
  };

  // ---- ACTIVITY HANDLERS ----

  const resetActivityForm = () => {
    setActTitle(""); setActDesc(""); setActDate(""); setActReward(""); setActCategory("meeting");
    setEditingActivity(null); setActCodeRequired(true); setActProofRequired(false); setActMaxParticipants("");
  };

  const handleCreateActivity = async () => {
    if (!actTitle || !actDate || !actReward) {
      toast({ title: "Missing fields", description: "Fill in title, date, and reward.", variant: "destructive" });
      return;
    }
    const code = generateCode(actTitle);
    try {
      await createActivityMutation.mutateAsync({ title: actTitle, description: actDesc || undefined, category: actCategory, date: actDate, reward: parseInt(actReward), code, code_required: actCodeRequired, proof_required: actProofRequired, max_participants: actMaxParticipants ? parseInt(actMaxParticipants) : null });
      if (actCodeRequired) {
        toast({ title: "Activity Created!", description: `Code: ${code}` });
      } else {
        toast({ title: "Activity Created!", description: "Proof-based activity (no attendance code shown)." });
      }
      broadcastNewActivity(actTitle, parseInt(actReward));
      resetActivityForm();
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Failed.", variant: "destructive" });
    }
  };

  const handleEditActivity = (act: any) => {
    setEditingActivity(act);
    setActTitle(act.title);
    setActDesc(act.description || "");
    setActDate(act.date);
    setActReward(String(act.reward));
    setActCategory(act.category);
    setActMaxParticipants(act.max_participants ? String(act.max_participants) : "");
  };

  const handleUpdateActivity = async () => {
    if (!editingActivity || !actTitle || !actDate || !actReward) return;
    try {
      await updateActivityMutation.mutateAsync({
        id: editingActivity.id, title: actTitle, description: actDesc || undefined,
        category: actCategory, date: actDate, reward: parseInt(actReward),
        max_participants: actMaxParticipants ? parseInt(actMaxParticipants) : null,
      });
      toast({ title: "Activity Updated ✅" });
      resetActivityForm();
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Failed.", variant: "destructive" });
    }
  };

  const handleDeleteActivity = async (id: string) => {
    try {
      await deleteActivityMutation.mutateAsync(id);
      toast({ title: "Activity Deleted" });
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Failed.", variant: "destructive" });
    }
  };

  // ---- HACKATHON HANDLERS ----

  const resetHackathonForm = () => {
    setHackTitle(""); setHackDesc(""); setHackStart(""); setHackEnd(""); setHackFee(""); setHackPrize(""); setHackTeams("");
    setEditingHackathon(null); setHackCoverFile(null);
  };

  const handleCreateHackathon = async () => {
    if (!hackTitle || !hackStart || !hackEnd || !hackFee || !hackPrize || !hackTeams) {
      toast({ title: "Missing fields", description: "Fill in all hackathon details.", variant: "destructive" });
      return;
    }
    try {
      let coverUrl: string | undefined;
      if (hackCoverFile && dbUser) {
        coverUrl = await uploadImage("hackathon-covers", hackCoverFile, dbUser.id);
      }
      await createHackathonMutation.mutateAsync({
        title: hackTitle, description: hackDesc || undefined,
        start_date: hackStart, end_date: hackEnd, entry_fee: parseInt(hackFee),
        prize_pool: parseInt(hackPrize), max_teams: parseInt(hackTeams),
        cover_image_url: coverUrl,
      });
      toast({ title: "Hackathon Posted!", description: `"${hackTitle}" is now live.` });
      broadcastNewHackathon(hackTitle, parseInt(hackFee), parseInt(hackPrize));
      resetHackathonForm();
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Failed.", variant: "destructive" });
    }
  };

  const handleEditHackathon = (hack: any) => {
    setEditingHackathon(hack);
    setHackTitle(hack.title);
    setHackDesc(hack.description || "");
    setHackStart(hack.start_date);
    setHackEnd(hack.end_date);
    setHackFee(String(hack.entry_fee));
    setHackPrize(String(hack.prize_pool));
    setHackTeams(String(hack.max_teams || ""));
  };

  const handleUpdateHackathon = async () => {
    if (!editingHackathon || !hackTitle || !hackStart || !hackEnd) return;
    try {
      await updateHackathonMutation.mutateAsync({
        id: editingHackathon.id, title: hackTitle, description: hackDesc || undefined,
        start_date: hackStart, end_date: hackEnd, entry_fee: parseInt(hackFee),
        prize_pool: parseInt(hackPrize), max_teams: parseInt(hackTeams),
      });
      toast({ title: "Hackathon Updated ✅" });
      resetHackathonForm();
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Failed.", variant: "destructive" });
    }
  };

  const handleDeleteHackathon = async (id: string) => {
    try {
      await deleteHackathonMutation.mutateAsync(id);
      toast({ title: "Hackathon Deleted" });
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Failed.", variant: "destructive" });
    }
  };

  // ---- REDEMPTION HANDLERS ----

  const handleProcessRedemption = async () => {
    if (!redeemAction) return;
    try {
      const result = await processRedemptionMutation.mutateAsync({
        requestId: redeemAction.id, action: redeemAction.action, notes: redeemNotes || undefined,
      });
      if (result?.success) {
        toast({ title: `Request ${redeemAction.action} ✅` });
        // Notify the user about their redemption status
        const req = redemptions.find((r: any) => r.id === redeemAction.id);
        if (req?.users?.telegram_id) {
          // For approved mentorship requests, send mentor contact info
          if (redeemAction.action === "approved" && req.category === "mentorship" && req.details?.mentorId) {
            const mentor = allMentors.find((m: any) => m.id === req.details.mentorId);
            if (mentor) {
              notifyMentorshipApproved(req.users.telegram_id, mentor.name, mentor.contact_info);
            } else {
              notifyRedemptionUpdate(req.users.telegram_id, req.category, redeemAction.action, redeemNotes || undefined);
            }
          } else {
            notifyRedemptionUpdate(req.users.telegram_id, req.category, redeemAction.action, redeemNotes || undefined);
          }
        }
      } else {
        toast({ title: "Error", description: result?.error, variant: "destructive" });
      }
      setRedeemAction(null);
      setRedeemNotes("");
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Failed.", variant: "destructive" });
    }
  };

  // ---- BALANCE ADJUSTMENT ----

  const handleAdjustBalance = async () => {
    if (!adjustUser || !adjustAmount || !adjustReason) return;
    try {
      const result = await adjustBalanceMutation.mutateAsync({
        userId: adjustUser.id, amount: parseInt(adjustAmount), reason: adjustReason,
      });
      if (result?.success) {
        toast({ title: "Balance Adjusted ✅", description: `${result.user}: new balance ${result.new_balance} DR` });
      } else {
        toast({ title: "Error", description: result?.error, variant: "destructive" });
      }
      setAdjustUser(null);
      setAdjustAmount("");
      setAdjustReason("");
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Failed.", variant: "destructive" });
    }
  };

  // ---- DELETE USER ----

  const handleDeleteUser = async () => {
    if (!deleteUserTarget) return;
    try {
      const result = await deleteUserMutation.mutateAsync({ userId: deleteUserTarget.id });
      if (result?.success) {
        toast({ title: "User Deleted", description: `${result.deleted_user} has been removed from the platform.` });
      } else {
        toast({ title: "Error", description: result?.error, variant: "destructive" });
      }
      setDeleteUserTarget(null);
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Failed to delete user.", variant: "destructive" });
    }
  };

  // ---- PROOF PROCESSING ----

  const handleProcessProof = async (logId: string, action: "approved" | "rejected") => {
    if (!dbUser) return;
    const { data, error } = await supabase.rpc("process_activity_proof", {
      p_admin_id: dbUser.id,
      p_log_id: logId,
      p_action: action,
    });
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    if (data?.success) {
      toast({ title: `Proof ${action}` });
      queryClient.invalidateQueries({ queryKey: ["pending_proofs"] });
      // Notify the user about their proof status
      const proof = pendingProofs.find((p: any) => p.id === logId);
      if (proof) {
        const userTgId = proof.users?.telegram_id;
        if (userTgId) {
          if (action === "approved") {
            notifyProofApproved(userTgId, proof.activities?.title || "Activity", proof.activities?.reward || 0);
          } else {
            notifyProofRejected(userTgId, proof.activities?.title || "Activity");
          }
        }
      }
    }
  };

  // ---- STATUS HELPERS ----

  const statusColor = (status: string) => {
    switch (status) {
      case "pending": return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
      case "approved": return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
      case "rejected": return "bg-red-500/20 text-red-400 border-red-500/30";
      case "fulfilled": return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      default: return "";
    }
  };

  const pendingCount = redemptions.filter((r: any) => r.status === "pending").length;
  const pendingProofCount = pendingProofs.length;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pb-28 px-4 pt-6">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <h1 className="text-2xl font-bold text-foreground mb-2">Admin Panel</h1>
        <p className="text-muted-foreground">Manage activities, hackathons, redemptions, and users</p>
      </motion.div>

      <Tabs defaultValue="activities" className="w-full">
        <div className="mb-6 overflow-x-auto scrollbar-hide -mx-4 px-4">
          <TabsList className="inline-flex w-auto min-w-full gap-1">
            <TabsTrigger value="activities" className="text-xs px-3">Activities</TabsTrigger>
            <TabsTrigger value="missions" className="text-xs px-3">Missions</TabsTrigger>
            <TabsTrigger value="hackathons" className="text-xs px-3">Hacks</TabsTrigger>
            <TabsTrigger value="redemptions" className="relative text-xs px-3">
              Redeem
              {pendingCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-destructive text-destructive-foreground text-[10px] rounded-full flex items-center justify-center">
                  {pendingCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="proofs" className="relative text-xs px-3">
              Proofs
              {pendingProofCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-destructive text-destructive-foreground text-[10px] rounded-full flex items-center justify-center">
                  {pendingProofCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="raffles" className="text-xs px-3">Raffles</TabsTrigger>
            <TabsTrigger value="promos" className="text-xs px-3">Promos</TabsTrigger>
            <TabsTrigger value="users" className="text-xs px-3">Users</TabsTrigger>
            <TabsTrigger value="referrals" className="text-xs px-3">Referrals</TabsTrigger>
            <TabsTrigger value="settings" className="text-xs px-3">Settings</TabsTrigger>
            <TabsTrigger value="states" className="text-xs px-3">States</TabsTrigger>
            <TabsTrigger value="broadcast" className="text-xs px-3">Broadcast</TabsTrigger>
          </TabsList>
        </div>

        {/* ========== ACTIVITIES TAB ========== */}
        <TabsContent value="activities">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="gradient-card border-border/50 p-5 mb-6">
              <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <Plus className="w-4 h-4 text-primary" />
                {editingActivity ? "Edit Activity" : "New Activity"}
              </h3>
              <div className="space-y-3">
                <Input placeholder="Activity title" value={actTitle} onChange={(e) => setActTitle(sanitize(e.target.value))} className="bg-secondary border-border" />
                <Textarea placeholder="Description (optional)" value={actDesc} onChange={(e) => setActDesc(e.target.value)} className="bg-secondary border-border min-h-[60px]" />
                <Input type="date" value={actDate} onChange={(e) => setActDate(e.target.value)} className="bg-secondary border-border" />
                <Input type="number" placeholder="DR reward amount" value={actReward} onChange={(e) => setActReward(e.target.value)} className="bg-secondary border-border" />
                <select value={actCategory} onChange={(e) => setActCategory(e.target.value)} className="w-full h-10 px-3 rounded-md bg-secondary border border-border text-foreground text-sm">
                  <option value="meeting">Meeting</option>
                  <option value="workshop">Workshop</option>
                  <option value="event">Event</option>
                  <option value="outreach">Outreach</option>
                </select>
                <Input type="number" placeholder="Max participants (optional — leave empty for unlimited)" value={actMaxParticipants} onChange={(e) => setActMaxParticipants(e.target.value)} className="bg-secondary border-border" />
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm text-foreground">
                    <input type="checkbox" checked={actCodeRequired} onChange={(e) => setActCodeRequired(e.target.checked)} />
                    Requires attendance code
                  </label>
                  <label className="flex items-center gap-2 text-sm text-foreground">
                    <input type="checkbox" checked={actProofRequired} onChange={(e) => setActProofRequired(e.target.checked)} />
                    Requires proof upload
                  </label>
                </div>
                <div className="flex gap-2">
                  {editingActivity ? (
                    <>
                      <Button className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground" onClick={handleUpdateActivity} disabled={updateActivityMutation.isPending}>
                        {updateActivityMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Pencil className="w-4 h-4 mr-2" />}
                        Save Changes
                      </Button>
                      <Button variant="outline" onClick={resetActivityForm}>Cancel</Button>
                    </>
                  ) : (
                    <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-glow" onClick={handleCreateActivity} disabled={createActivityMutation.isPending}>
                      {createActivityMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                      Create & Generate Code
                    </Button>
                  )}
                </div>
              </div>
            </Card>

            {activities.length > 0 && (
              <div>
                <h3 className="font-semibold text-foreground mb-3">All Activities ({activities.length})</h3>
                <div className="space-y-3">
                  {activities.map((act: any) => (
                    <Card key={act.id} className="gradient-card border-border/50 p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <h4 className="font-medium text-foreground">{act.title}</h4>
                          {act.description && <p className="text-xs text-muted-foreground mt-1">{act.description}</p>}
                          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                            <span className="flex items-center gap-1"><CalendarDays className="w-3 h-3" />{new Date(act.date).toLocaleDateString()}</span>
                            <span className="flex items-center gap-1"><Coins className="w-3 h-3 text-primary" />{act.reward} DR</span>
                            {act.max_participants && <span className="flex items-center gap-1"><Users className="w-3 h-3" />Max {act.max_participants}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Badge variant="secondary" className="text-xs">{act.category}</Badge>
                          <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Edit" onClick={() => handleEditActivity(act)}>
                            <Pencil className="w-3 h-3" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" aria-label="Delete" onClick={() => handleDeleteActivity(act.id)}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                      {act.code_required !== false ? (
                        <div className="flex items-center gap-2 mt-3 p-2 bg-secondary rounded-lg">
                          <KeyRound className="w-4 h-4 text-primary" />
                          <code className="text-sm text-primary font-mono flex-1">{act.code}</code>
                          <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Copy to clipboard" onClick={() => copyCode(act.code)}>
                            <Copy className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 mt-3">
                          <Badge variant="secondary" className="text-xs"><ImageIcon className="w-3 h-3 mr-1" />Proof-based</Badge>
                        </div>
                      )}
                      <Button size="sm" variant="outline" className="mt-2 w-full border-border text-xs" onClick={() => setViewingActivityParticipants(viewingActivityParticipants === act.id ? null : act.id)}>
                        <Users className="w-3 h-3 mr-1" /> {viewingActivityParticipants === act.id ? "Hide" : "View"} Participants
                      </Button>
                      {viewingActivityParticipants === act.id && (
                        <ActivityParticipantsList activityId={act.id} />
                      )}
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        </TabsContent>

        {/* ========== MISSIONS TAB ========== */}
        <TabsContent value="missions">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="gradient-card border-border/50 p-5 mb-6">
              <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <Target className="w-4 h-4 text-primary" />
                Create Monthly Mission
              </h3>
              <div className="space-y-3">
                <Input placeholder="Mission title" value={missionTitle} onChange={(e) => setMissionTitle(sanitize(e.target.value))} className="bg-secondary border-border" />
                <Textarea placeholder="Mission description (hidden until unlocked)" value={missionDesc} onChange={(e) => setMissionDesc(e.target.value)} className="bg-secondary border-border min-h-[80px]" />
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-xs text-muted-foreground mb-1 block">Unlock Fee (DR)</label><Input type="number" placeholder="e.g. 100" value={missionUnlockFee} onChange={(e) => setMissionUnlockFee(e.target.value)} className="bg-secondary border-border" /></div>
                  <div><label className="text-xs text-muted-foreground mb-1 block">Reward (DR)</label><Input type="number" placeholder="e.g. 500" value={missionReward} onChange={(e) => setMissionReward(e.target.value)} className="bg-secondary border-border" /></div>
                </div>
                <Input placeholder="Completion code (given to users who finish)" value={missionCode} onChange={(e) => setMissionCode(e.target.value.toUpperCase())} className="bg-secondary border-border font-mono" />
                <div><label className="text-xs text-muted-foreground mb-1 block">Expires (optional)</label><Input type="date" value={missionExpiry} onChange={(e) => setMissionExpiry(e.target.value)} className="bg-secondary border-border" /></div>
                <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-glow" disabled={!missionTitle || !missionUnlockFee || !missionReward || !missionCode || createMissionMutation.isPending}
                  onClick={async () => {
                    try {
                      await createMissionMutation.mutateAsync({
                        title: missionTitle,
                        description: missionDesc || undefined,
                        category: "special",
                        reward: parseInt(missionReward),
                        unlock_fee: parseInt(missionUnlockFee),
                        completion_code: missionCode,
                        expires_at: missionExpiry ? new Date(missionExpiry).toISOString() : undefined,
                      });
                      toast({ title: "Mission Created", description: `${missionTitle} — Code: ${missionCode}` });
                      broadcastNewMission(missionTitle, parseInt(missionUnlockFee), parseInt(missionReward));
                      setMissionTitle(""); setMissionDesc(""); setMissionReward(""); setMissionUnlockFee(""); setMissionCode(""); setMissionExpiry("");
                    } catch (err: any) {
                      toast({ title: "Error", description: err?.message || "Failed", variant: "destructive" });
                    }
                  }}>
                  {createMissionMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Target className="w-4 h-4 mr-2" />}
                  Create Mission
                </Button>
              </div>
            </Card>

            {allMissions.filter((m: any) => m.unlock_fee > 0).length > 0 && (
              <div>
                <h3 className="font-semibold text-foreground mb-3">Paid Missions ({allMissions.filter((m: any) => m.unlock_fee > 0).length})</h3>
                <div className="space-y-3">
                  {allMissions.filter((m: any) => m.unlock_fee > 0).map((m: any) => (
                    <Card key={m.id} className="gradient-card border-border/50 p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <h4 className="font-medium text-foreground">{m.title}</h4>
                          {m.description && <p className="text-xs text-muted-foreground mt-1">{m.description}</p>}
                        </div>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" aria-label="Delete" onClick={async () => { await deleteMissionMutation.mutateAsync(m.id); toast({ title: "Mission deleted" }); }}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
                        <span className="flex items-center gap-1"><Lock className="w-3 h-3" />{m.unlock_fee} DR unlock</span>
                        <span className="flex items-center gap-1"><Coins className="w-3 h-3 text-primary" />+{m.reward} DR reward</span>
                        {m.expires_at && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(m.expires_at).toLocaleDateString()}</span>}
                      </div>
                      <div className="flex items-center gap-2 p-2 bg-secondary rounded-lg">
                        <KeyRound className="w-4 h-4 text-primary" />
                        <code className="text-sm text-primary font-mono flex-1">{m.completion_code}</code>
                        <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Copy" onClick={() => { navigator.clipboard.writeText(m.completion_code); toast({ title: "Copied!" }); }}>
                          <Copy className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                      <Button size="sm" variant="outline" className="mt-2 w-full border-border text-xs" onClick={() => setViewingMissionParticipants(viewingMissionParticipants === m.id ? null : m.id)}>
                        <Users className="w-3 h-3 mr-1" /> {viewingMissionParticipants === m.id ? "Hide" : "View"} Participants
                      </Button>
                      {viewingMissionParticipants === m.id && (
                        <MissionParticipantsList missionId={m.id} />
                      )}
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        </TabsContent>

        {/* ========== HACKATHONS TAB ========== */}
        <TabsContent value="hackathons">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="gradient-card border-border/50 p-5 mb-6">
              <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <Rocket className="w-4 h-4 text-primary" />
                {editingHackathon ? "Edit Hackathon" : "Post Hackathon"}
              </h3>
              <div className="space-y-3">
                <Input placeholder="Hackathon title" value={hackTitle} onChange={(e) => setHackTitle(sanitize(e.target.value))} className="bg-secondary border-border" />
                <Textarea placeholder="Description (optional)" value={hackDesc} onChange={(e) => setHackDesc(e.target.value)} className="bg-secondary border-border min-h-[60px]" />
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-xs text-muted-foreground mb-1 block">Start Date</label><Input type="date" value={hackStart} onChange={(e) => setHackStart(e.target.value)} className="bg-secondary border-border" /></div>
                  <div><label className="text-xs text-muted-foreground mb-1 block">End Date</label><Input type="date" value={hackEnd} onChange={(e) => setHackEnd(e.target.value)} className="bg-secondary border-border" /></div>
                </div>
                <Input type="number" placeholder="Entry fee in DR" value={hackFee} onChange={(e) => setHackFee(e.target.value)} className="bg-secondary border-border" />
                <Input type="number" placeholder="Prize pool in DR" value={hackPrize} onChange={(e) => setHackPrize(e.target.value)} className="bg-secondary border-border" />
                <Input type="number" placeholder="Max teams" value={hackTeams} onChange={(e) => setHackTeams(e.target.value)} className="bg-secondary border-border" />
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Cover Image (optional)</label>
                  <Input type="file" accept="image/*" onChange={(e) => setHackCoverFile(e.target.files?.[0] || null)} className="bg-secondary border-border" />
                </div>
                <div className="flex gap-2">
                  {editingHackathon ? (
                    <>
                      <Button className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground" onClick={handleUpdateHackathon} disabled={updateHackathonMutation.isPending}>
                        {updateHackathonMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Pencil className="w-4 h-4 mr-2" />}
                        Save Changes
                      </Button>
                      <Button variant="outline" onClick={resetHackathonForm}>Cancel</Button>
                    </>
                  ) : (
                    <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-glow" onClick={handleCreateHackathon} disabled={createHackathonMutation.isPending}>
                      {createHackathonMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Rocket className="w-4 h-4 mr-2" />}
                      Post Hackathon
                    </Button>
                  )}
                </div>
              </div>
            </Card>

            {hackathons.length > 0 && (
              <div>
                <h3 className="font-semibold text-foreground mb-3">All Hackathons ({hackathons.length})</h3>
                <div className="space-y-3">
                  {hackathons.map((hack: any) => (
                    <Card key={hack.id} className="gradient-card border-border/50 p-4">
                      {hack.cover_image_url && (
                        <img src={hack.cover_image_url} alt="" className="w-full h-32 object-cover rounded-lg mb-3" />
                      )}
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <h4 className="font-medium text-foreground">{hack.title}</h4>
                          {hack.description && <p className="text-xs text-muted-foreground mt-1">{hack.description}</p>}
                        </div>
                        <div className="flex items-center gap-1">
                          <Badge variant="outline" className="text-xs">{hack.status}</Badge>
                          <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Edit" onClick={() => handleEditHackathon(hack)}>
                            <Pencil className="w-3 h-3" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" aria-label="Delete" onClick={() => handleDeleteHackathon(hack.id)}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><CalendarDays className="w-3 h-3" />{new Date(hack.start_date).toLocaleDateString()} – {new Date(hack.end_date).toLocaleDateString()}</span>
                        <span className="flex items-center gap-1"><Coins className="w-3 h-3 text-primary" />{hack.entry_fee} DR</span>
                        {hack.max_teams && <span className="flex items-center gap-1"><Users className="w-3 h-3" />{hack.registered_count}/{hack.max_teams}</span>}
                        <span className="flex items-center gap-1"><Trophy className="w-3 h-3 text-primary" />{hack.prize_pool} DR</span>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        </TabsContent>

        {/* ========== REDEMPTIONS TAB ========== */}
        <TabsContent value="redemptions">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            {redemptions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No redemption requests yet.</p>
            ) : (
              <div className="space-y-3">
                {redemptions.map((req: any) => {
                  const user = req.users;
                  const userName = user ? [user.first_name, user.last_name].filter(Boolean).join(" ") : "Unknown";
                  return (
                    <Card key={req.id} className="gradient-card border-border/50 p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className={statusColor(req.status)}>{req.status}</Badge>
                            <Badge variant="secondary" className="text-xs">{req.category}</Badge>
                          </div>
                          <p className="font-medium text-foreground text-sm">{userName}</p>
                          {user?.username && <p className="text-xs text-muted-foreground">@{user.username}</p>}
                        </div>
                        <div className="text-right">
                          <p className="text-primary font-bold">{req.amount} DR</p>
                          <p className="text-xs text-muted-foreground">{new Date(req.created_at).toLocaleDateString()}</p>
                        </div>
                      </div>

                      {/* Details */}
                      {req.details && Object.keys(req.details).length > 0 && (
                        <div className="bg-secondary rounded-lg p-3 mb-3">
                          {Object.entries(req.details).map(([key, value]) => (
                            <div key={key} className="flex justify-between text-xs mb-1 last:mb-0">
                              <span className="text-muted-foreground capitalize">{key.replace(/([A-Z])/g, " $1")}</span>
                              <span className="text-foreground font-medium">{String(value)}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {req.admin_notes && (
                        <p className="text-xs text-muted-foreground mb-2 italic">Note: {req.admin_notes}</p>
                      )}

                      {req.status === "pending" && (
                        <div className="flex gap-2">
                          <Button size="sm" className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => { setRedeemAction({ id: req.id, action: "approved" }); setRedeemNotes(""); }}>
                            <CheckCircle className="w-3 h-3 mr-1" /> Approve
                          </Button>
                          <Button size="sm" variant="outline" className="flex-1 border-destructive/30 text-destructive hover:bg-destructive/10" onClick={() => { setRedeemAction({ id: req.id, action: "rejected" }); setRedeemNotes(""); }}>
                            <XCircle className="w-3 h-3 mr-1" /> Reject
                          </Button>
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}
          </motion.div>
        </TabsContent>

        {/* ========== PROOFS TAB ========== */}
        <TabsContent value="proofs">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            {pendingProofs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No pending proofs to review.</p>
            ) : (
              <div className="space-y-3">
                {pendingProofs.map((proof: any) => {
                  const user = proof.users;
                  const userName = user ? [user.first_name, user.last_name].filter(Boolean).join(" ") : "Unknown";
                  const activity = proof.activities;
                  return (
                    <Card key={proof.id} className="gradient-card border-border/50 p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <p className="font-medium text-foreground text-sm">{userName}</p>
                          {user?.username && <p className="text-xs text-muted-foreground">@{user.username}</p>}
                        </div>
                        <div className="text-right">
                          {activity && (
                            <>
                              <p className="text-sm text-foreground font-medium">{activity.title}</p>
                              <p className="text-xs text-primary font-semibold">{activity.reward} DR</p>
                            </>
                          )}
                        </div>
                      </div>

                      {proof.proof_image_url && (
                        <img
                          src={proof.proof_image_url}
                          alt="Proof"
                          className="w-full h-40 object-cover rounded-lg mb-3 cursor-pointer"
                          onClick={() => window.open(proof.proof_image_url, "_blank")}
                        />
                      )}

                      <div className="flex gap-2">
                        <Button size="sm" className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => handleProcessProof(proof.id, "approved")}>
                          <CheckCircle className="w-3 h-3 mr-1" /> Approve
                        </Button>
                        <Button size="sm" variant="outline" className="flex-1 border-destructive/30 text-destructive hover:bg-destructive/10" onClick={() => handleProcessProof(proof.id, "rejected")}>
                          <XCircle className="w-3 h-3 mr-1" /> Reject
                        </Button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </motion.div>
        </TabsContent>

        {/* ========== RAFFLES TAB ========== */}
        <TabsContent value="raffles">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="gradient-card border-border/50 p-5 mb-6">
              <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <Ticket className="w-4 h-4 text-primary" />
                Create Raffle
              </h3>
              <div className="space-y-3">
                <Input placeholder="Raffle title" value={raffleTitle} onChange={(e) => setRaffleTitle(sanitize(e.target.value))} className="bg-secondary border-border" />
                <Textarea placeholder="Description (optional)" value={raffleDesc} onChange={(e) => setRaffleDesc(e.target.value)} className="bg-secondary border-border min-h-[60px]" />
                <Input type="number" placeholder="Entry fee in DR (e.g. 50)" value={raffleFee} onChange={(e) => setRaffleFee(e.target.value)} className="bg-secondary border-border" />
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">End Date & Time</label>
                  <Input type="datetime-local" value={raffleEnd} onChange={(e) => setRaffleEnd(e.target.value)} className="bg-secondary border-border" />
                </div>
                <Input type="number" placeholder="Max entries (optional)" value={raffleMaxEntries} onChange={(e) => setRaffleMaxEntries(e.target.value)} className="bg-secondary border-border" />
                <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-glow" disabled={!raffleTitle || !raffleFee || !raffleEnd || createRaffleMutation.isPending}
                  onClick={async () => {
                    try {
                      await createRaffleMutation.mutateAsync({
                        title: raffleTitle,
                        description: raffleDesc || undefined,
                        entry_fee: parseInt(raffleFee),
                        end_date: new Date(raffleEnd).toISOString(),
                        max_entries: raffleMaxEntries ? parseInt(raffleMaxEntries) : undefined,
                      });
                      toast({ title: "Raffle Created", description: raffleTitle });
                      setRaffleTitle(""); setRaffleDesc(""); setRaffleFee(""); setRaffleEnd(""); setRaffleMaxEntries("");
                    } catch (err: any) {
                      toast({ title: "Error", description: err?.message || "Failed", variant: "destructive" });
                    }
                  }}>
                  {createRaffleMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Ticket className="w-4 h-4 mr-2" />}
                  Create Raffle
                </Button>
              </div>
            </Card>

            {raffles.length > 0 && (
              <div>
                <h3 className="font-semibold text-foreground mb-3">All Raffles ({raffles.length})</h3>
                <div className="space-y-3">
                  {raffles.map((r: any) => {
                    const isEnded = r.status === "ended";
                    const winner = r.winner as any;
                    return (
                      <Card key={r.id} className="gradient-card border-border/50 p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <h4 className="font-medium text-foreground">{r.title}</h4>
                            {r.description && <p className="text-xs text-muted-foreground mt-1">{r.description}</p>}
                          </div>
                          <div className="flex items-center gap-1">
                            <Badge variant="outline" className={isEnded ? "text-xs bg-muted" : "text-xs bg-emerald-500/20 text-emerald-400 border-emerald-500/30"}>{isEnded ? "Ended" : "Active"}</Badge>
                            {!isEnded && (
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" aria-label="Delete" onClick={async () => {
                                await deleteRaffleMutation.mutateAsync(r.id);
                                toast({ title: "Raffle deleted" });
                              }}>
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                          <span className="flex items-center gap-1"><Coins className="w-3 h-3 text-primary" />{r.entry_fee} DR</span>
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(r.end_date).toLocaleDateString()}</span>
                          {r.max_entries && <span className="flex items-center gap-1"><Users className="w-3 h-3" />Max {r.max_entries}</span>}
                        </div>

                        {winner && (
                          <div className="bg-primary/10 border border-primary/20 rounded-lg p-2 mb-3">
                            <p className="text-xs text-foreground"><Trophy className="w-3 h-3 text-primary inline mr-1" />Winner: {winner.first_name}{winner.username ? ` (@${winner.username})` : ""}</p>
                          </div>
                        )}

                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" className="flex-1 border-border" onClick={() => setViewingRaffleEntries(viewingRaffleEntries === r.id ? null : r.id)}>
                            <Users className="w-3 h-3 mr-1" /> Entries
                          </Button>
                          {!isEnded && (
                            <Button size="sm" className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground" disabled={drawWinnerMutation.isPending}
                              onClick={async () => {
                                const result = await drawWinnerMutation.mutateAsync(r.id);
                                if (result?.success) {
                                  toast({ title: "Winner Drawn!", description: `${result.winner}${result.winner_username ? ` (@${result.winner_username})` : ""} won ${result.prize} DR!` });
                                } else {
                                  toast({ title: "Error", description: result?.error, variant: "destructive" });
                                }
                              }}>
                              {drawWinnerMutation.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Sparkles className="w-3 h-3 mr-1" />}
                              Draw Winner
                            </Button>
                          )}
                        </div>

                        {viewingRaffleEntries === r.id && (
                          <RaffleEntriesList raffleId={r.id} />
                        )}
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}
          </motion.div>
        </TabsContent>

        {/* ========== PROMOS TAB ========== */}
        <TabsContent value="promos">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            {/* Generate batch */}
            <Card className="gradient-card border-border/50 p-5 mb-4">
              <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <Gift className="w-4 h-4 text-primary" />
                Generate Promo Codes
              </h3>
              <div className="space-y-3">
                <Input type="number" placeholder="How many codes?" value={promoBatchCount} onChange={(e) => setPromoBatchCount(e.target.value)} className="bg-secondary border-border" />
                <Input type="number" placeholder="Reward per code (DR)" value={promoReward} onChange={(e) => setPromoReward(e.target.value)} className="bg-secondary border-border" />
                <Input placeholder="Description" value={promoDesc} onChange={(e) => setPromoDesc(e.target.value)} className="bg-secondary border-border" />
                <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-glow" disabled={!promoBatchCount || !promoReward || generatePromoCodesMutation.isPending}
                  onClick={async () => {
                    try {
                      const result = await generatePromoCodesMutation.mutateAsync({
                        count: parseInt(promoBatchCount),
                        reward: parseInt(promoReward),
                        description: promoDesc || undefined,
                      });
                      toast({ title: "Codes Generated", description: `${result?.length || 0} promo codes created` });
                    } catch (err: any) {
                      toast({ title: "Error", description: err?.message || "Failed", variant: "destructive" });
                    }
                  }}>
                  {generatePromoCodesMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                  Generate {promoBatchCount || 0} Codes
                </Button>
              </div>
            </Card>

            {/* Or create single code */}
            <Card className="gradient-card border-border/50 p-5 mb-6">
              <h3 className="font-semibold text-foreground mb-4 text-sm">Or Create Single Code</h3>
              <div className="flex gap-2">
                <Input placeholder="Custom code" value={promoCodeInput} onChange={(e) => setPromoCodeInput(e.target.value.toUpperCase())} className="bg-secondary border-border font-mono flex-1" />
                <Button size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground" disabled={!promoCodeInput.trim() || createPromoCodeMutation.isPending}
                  onClick={async () => {
                    try {
                      await createPromoCodeMutation.mutateAsync({
                        code: promoCodeInput.trim(),
                        reward: parseInt(promoReward) || 500,
                        description: promoDesc || undefined,
                      });
                      toast({ title: "Code Created", description: promoCodeInput.trim() });
                      setPromoCodeInput("");
                    } catch (err: any) {
                      toast({ title: "Error", description: err?.message || "Duplicate code?", variant: "destructive" });
                    }
                  }}>
                  {createPromoCodeMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                </Button>
              </div>
            </Card>

            {/* Code list */}
            {promoCodes.length > 0 && (
              <div>
                <h3 className="font-semibold text-foreground mb-3">All Codes ({promoCodes.length})</h3>
                <div className="space-y-2">
                  {promoCodes.map((p: any) => (
                    <Card key={p.id} className={`border-border/50 p-3 ${p.is_used ? "opacity-60" : "gradient-card"}`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-mono text-sm font-bold text-foreground">{p.code}</p>
                          <p className="text-xs text-muted-foreground">{p.reward} DR — {p.description || "No description"}</p>
                          {p.is_used && p.claimed_user && (
                            <p className="text-xs text-emerald-400 mt-0.5">
                              Claimed by {p.claimed_user.first_name}{p.claimed_user.username ? ` (@${p.claimed_user.username})` : ""} — {new Date(p.claimed_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                            </p>
                          )}
                        </div>
                        <Badge className={p.is_used ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]" : "bg-primary/20 text-primary border-primary/30 text-[10px]"}>
                          {p.is_used ? "Used" : "Available"}
                        </Badge>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        </TabsContent>

        {/* ========== USERS TAB ========== */}
        <TabsContent value="users">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="mb-4">
              <p className="text-sm text-muted-foreground">{allUsers.length} registered users</p>
            </div>
            <div className="space-y-3">
              {allUsers.map((u: any) => (
                <Card key={u.id} className="gradient-card border-border/50 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-foreground text-sm">
                          {[u.first_name, u.last_name].filter(Boolean).join(" ")}
                        </p>
                        {u.is_admin && <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px]">Admin</Badge>}
                      </div>
                      {u.username && <p className="text-xs text-muted-foreground">@{u.username}</p>}
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                        <span>ID: {u.telegram_id}</span>
                        <span>Streak: {u.streak}</span>
                        <span>Status: {u.status}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                        Joined: {new Date(u.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} at {new Date(u.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                    <div className="text-right flex items-center gap-2">
                      <div>
                        <p className="text-primary font-bold text-sm">{u.balance.toLocaleString()} DR</p>
                        <p className="text-xs text-muted-foreground">Earned: {u.total_earned.toLocaleString()}</p>
                      </div>
                      <Button size="icon" variant="outline" className="h-8 w-8 border-primary/30" aria-label="Adjust balance" onClick={() => { setAdjustUser(u); setAdjustAmount(""); setAdjustReason(""); }}>
                        <Coins className="w-3.5 h-3.5 text-primary" />
                      </Button>
                      {!u.is_admin && (
                        <Button size="icon" variant="outline" className="h-8 w-8 border-destructive/30" aria-label="Delete user" onClick={() => setDeleteUserTarget(u)}>
                          <UserX className="w-3.5 h-3.5 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </motion.div>
        </TabsContent>

        {/* ========== REFERRALS TAB ========== */}
        <TabsContent value="referrals">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="mb-4">
              <p className="text-sm text-muted-foreground">{allUsers.length} users &middot; {allReferrals.length} referrals</p>
            </div>
            <div className="space-y-3">
              {allUsers.map((u: any) => {
                const userReferrals = allReferrals.filter((r: any) => r.referrer?.id === u.id);
                return (
                  <Card key={u.id} className="gradient-card border-border/50 p-4">
                    <div className="flex items-center justify-between mb-1">
                      <div>
                        <p className="font-medium text-foreground text-sm">
                          {[u.first_name, u.last_name].filter(Boolean).join(" ")}
                        </p>
                        {u.username && <p className="text-xs text-muted-foreground">@{u.username}</p>}
                      </div>
                      <Badge className={userReferrals.length > 0 ? "bg-primary/20 text-primary border-primary/30 text-xs" : "bg-secondary text-muted-foreground border-border text-xs"}>
                        {userReferrals.length} referral{userReferrals.length !== 1 ? "s" : ""}
                      </Badge>
                    </div>
                    {userReferrals.length > 0 && (
                      <div className="mt-2 space-y-1.5 pl-3 border-l-2 border-primary/20">
                        {userReferrals.map((ref: any) => (
                          <div key={ref.referred?.id || ref.id} className="flex items-center justify-between">
                            <div>
                              <p className="text-xs text-foreground">
                                {[ref.referred?.first_name, ref.referred?.last_name].filter(Boolean).join(" ")}
                              </p>
                              {ref.referred?.username && (
                                <p className="text-[10px] text-muted-foreground">@{ref.referred.username}</p>
                              )}
                            </div>
                            <p className="text-[10px] text-muted-foreground/60">
                              {new Date(ref.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                    {userReferrals.length === 0 && (
                      <p className="text-[10px] text-muted-foreground/50 mt-1">No referrals yet</p>
                    )}
                  </Card>
                );
              })}
            </div>
          </motion.div>
        </TabsContent>

        {/* ========== SETTINGS TAB ========== */}
        <TabsContent value="settings">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            {/* DR / Naira Calculator */}
            <Card className="gradient-card border-border/50 p-5 mb-6">
              <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                <Coins className="w-4 h-4 text-primary" />
                DR / Naira Calculator
              </h3>
              <p className="text-xs text-muted-foreground mb-3">1 DR = &#8358;0.33</p>
              <Input
                type="number"
                placeholder="Enter DR amount"
                value={calcDR}
                onChange={(e) => setCalcDR(e.target.value)}
                className="bg-secondary border-border mb-3"
              />
              {calcDR && Number(calcDR) > 0 && (
                <div className="bg-secondary rounded-lg p-3 text-center">
                  <p className="text-sm text-muted-foreground">{Number(calcDR).toLocaleString()} DR =</p>
                  <p className="text-2xl font-bold text-primary">&#8358;{(Number(calcDR) * 0.33).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
              )}
            </Card>

            {/* Redemption Costs */}
            <Card className="gradient-card border-border/50 p-5 mb-6">
              <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <Coins className="w-4 h-4 text-primary" />
                Redemption Costs
              </h3>
              <p className="text-xs text-muted-foreground mb-4">
                Edit the minimum DR needed for each redemption category. Changes apply immediately.
              </p>
              <div className="space-y-3">
                {redeemCategories.map((cat: any) => (
                  <div key={cat.id} className="flex items-center gap-3">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">{cat.title}</p>
                      <p className="text-xs text-muted-foreground">{cat.description}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        className="w-24 bg-secondary border-border text-right text-sm"
                        value={editingCosts[cat.id] ?? String(cat.cost)}
                        onChange={(e) => setEditingCosts({ ...editingCosts, [cat.id]: e.target.value })}
                      />
                      <span className="text-xs text-muted-foreground">DR</span>
                      {editingCosts[cat.id] !== undefined && editingCosts[cat.id] !== String(cat.cost) && (
                        <Button
                          size="sm"
                          className="bg-primary hover:bg-primary/90 text-primary-foreground h-8 px-2"
                          disabled={updateCategoryMutation.isPending}
                          onClick={async () => {
                            const newCost = parseInt(editingCosts[cat.id]);
                            if (isNaN(newCost) || newCost < 0) return;
                            try {
                              await updateCategoryMutation.mutateAsync({ id: cat.id, cost: newCost });
                              toast({ title: `${cat.title} updated to ${newCost} DR` });
                              setEditingCosts((prev) => { const next = { ...prev }; delete next[cat.id]; return next; });
                            } catch (err: any) {
                              toast({ title: "Error", description: err?.message, variant: "destructive" });
                            }
                          }}
                        >
                          {updateCategoryMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Mentors Management */}
            <Card className="gradient-card border-border/50 p-5 mb-6">
              <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                {editingMentor ? "Edit Mentor" : "Add Mentor"}
              </h3>
              <div className="space-y-3">
                <Input
                  placeholder="Mentor name"
                  value={mentorName}
                  onChange={(e) => setMentorName(sanitize(e.target.value))}
                  className="bg-secondary border-border"
                />
                <Input
                  placeholder="Specialty (e.g. Business, Tech, Career)"
                  value={mentorSpecialty}
                  onChange={(e) => setMentorSpecialty(sanitize(e.target.value))}
                  className="bg-secondary border-border"
                />
                <Textarea
                  placeholder="Contact info (sent to user on approval, e.g. email, phone, Telegram handle)"
                  value={mentorContact}
                  onChange={(e) => setMentorContact(e.target.value)}
                  className="bg-secondary border-border min-h-[60px]"
                />
                <div className="flex gap-2">
                  {editingMentor ? (
                    <>
                      <Button
                        className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
                        disabled={updateMentorMutation.isPending || !mentorName || !mentorContact}
                        onClick={async () => {
                          try {
                            await updateMentorMutation.mutateAsync({
                              id: editingMentor.id,
                              name: mentorName,
                              specialty: mentorSpecialty,
                              contact_info: mentorContact,
                            });
                            toast({ title: "Mentor Updated" });
                            setEditingMentor(null); setMentorName(""); setMentorSpecialty(""); setMentorContact("");
                          } catch (err: any) {
                            toast({ title: "Error", description: err?.message, variant: "destructive" });
                          }
                        }}
                      >
                        {updateMentorMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Pencil className="w-4 h-4 mr-2" />}
                        Save Changes
                      </Button>
                      <Button variant="outline" onClick={() => { setEditingMentor(null); setMentorName(""); setMentorSpecialty(""); setMentorContact(""); }}>
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <Button
                      className="w-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-glow"
                      disabled={createMentorMutation.isPending || !mentorName || !mentorContact}
                      onClick={async () => {
                        try {
                          await createMentorMutation.mutateAsync({
                            name: mentorName,
                            specialty: mentorSpecialty,
                            contact_info: mentorContact,
                          });
                          toast({ title: "Mentor Added" });
                          setMentorName(""); setMentorSpecialty(""); setMentorContact("");
                        } catch (err: any) {
                          toast({ title: "Error", description: err?.message, variant: "destructive" });
                        }
                      }}
                    >
                      {createMentorMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                      Add Mentor
                    </Button>
                  )}
                </div>
              </div>
            </Card>

            {allMentors.length > 0 && (
              <div>
                <h3 className="font-semibold text-foreground mb-3">All Mentors ({allMentors.length})</h3>
                <div className="space-y-3">
                  {allMentors.map((mentor: any) => (
                    <Card key={mentor.id} className="gradient-card border-border/50 p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium text-foreground">{mentor.name}</h4>
                            {!mentor.is_active && <Badge variant="secondary" className="text-xs">Inactive</Badge>}
                          </div>
                          {mentor.specialty && <p className="text-xs text-muted-foreground">Specialty: {mentor.specialty}</p>}
                          <p className="text-xs text-muted-foreground mt-1">Contact: {mentor.contact_info}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            aria-label="Edit"
                            onClick={() => {
                              setEditingMentor(mentor);
                              setMentorName(mentor.name);
                              setMentorSpecialty(mentor.specialty || "");
                              setMentorContact(mentor.contact_info || "");
                            }}
                          >
                            <Pencil className="w-3 h-3" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className={`h-7 w-7 ${mentor.is_active ? "text-muted-foreground" : "text-emerald-400"}`}
                            aria-label={mentor.is_active ? "Deactivate" : "Activate"}
                            onClick={async () => {
                              try {
                                await updateMentorMutation.mutateAsync({ id: mentor.id, is_active: !mentor.is_active });
                                toast({ title: mentor.is_active ? "Mentor deactivated" : "Mentor activated" });
                              } catch (err: any) {
                                toast({ title: "Error", description: err?.message, variant: "destructive" });
                              }
                            }}
                          >
                            {mentor.is_active ? <XCircle className="w-3 h-3" /> : <CheckCircle className="w-3 h-3" />}
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            aria-label="Delete"
                            onClick={async () => {
                              try {
                                await deleteMentorMutation.mutateAsync(mentor.id);
                                toast({ title: "Mentor Deleted" });
                              } catch (err: any) {
                                toast({ title: "Error", description: err?.message, variant: "destructive" });
                              }
                            }}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        </TabsContent>

        {/* ========== BROADCAST TAB ========== */}
        {/* ========== STATES TAB ========== */}
        <TabsContent value="states">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            {/* Add State Form */}
            <Card className="gradient-card border-border/50 p-4 mb-4">
              <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary" /> Add New State
              </h3>
              <div className="flex gap-2">
                <Input
                  placeholder="State name (e.g. Edo)"
                  value={stateName}
                  onChange={(e) => setStateName(e.target.value)}
                  className="bg-secondary border-border"
                  onKeyDown={(e) => e.key === "Enter" && handleCreateState()}
                />
                <Button
                  className="bg-primary hover:bg-primary/90 text-primary-foreground px-4"
                  onClick={handleCreateState}
                  disabled={!stateName.trim() || createStateMutation.isPending}
                >
                  {createStateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                </Button>
              </div>
            </Card>

            {/* States List */}
            <div className="space-y-2">
              {allStates.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No states created yet.</p>
              ) : (
                allStates.map((state: any) => {
                  const ranking = stateRankings.find((r: any) => r.state_id === state.id);
                  const memberCount = ranking ? Number(ranking.member_count) : 0;
                  const totalBalance = ranking ? Number(ranking.total_balance) : 0;
                  return (
                    <Card key={state.id} className="gradient-card border-border/50 p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center">
                            <MapPin className="w-4 h-4 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium text-foreground text-sm">{state.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {memberCount} members · {totalBalance.toLocaleString()} DR
                            </p>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 px-2"
                          onClick={() => handleDeleteState(state.id)}
                          disabled={deleteStateMutation.isPending}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </Card>
                  );
                })
              )}
            </div>
          </motion.div>
        </TabsContent>

        <TabsContent value="broadcast">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="gradient-card border-border/50 p-5 mb-6">
              <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <Megaphone className="w-4 h-4 text-primary" />
                Broadcast Message
              </h3>
              <p className="text-xs text-muted-foreground mb-4">
                Send an in-chat message to all {allUsers.filter((u: any) => u.telegram_id !== 0).length} registered users via the Telegram bot.
              </p>
              {/* Cover image upload */}
              {broadcastImg ? (
                <div className="relative mb-4">
                  <img src={URL.createObjectURL(broadcastImg)} alt="Cover" className="w-full h-40 object-cover rounded-lg border border-border" />
                  <Button size="icon" variant="ghost" className="absolute top-2 right-2 bg-black/50 h-7 w-7" aria-label="Remove image" onClick={() => { setBroadcastImg(null); setBroadcastImgUrl(""); }}>
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ) : (
                <label className="flex items-center justify-center gap-2 w-full h-20 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 mb-4">
                  <ImageIcon className="w-5 h-5 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Add cover image (optional)</span>
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => setBroadcastImg(e.target.files?.[0] || null)} />
                </label>
              )}

              <Textarea
                placeholder="Type your message here... (supports HTML: <b>bold</b>, <i>italic</i>)"
                value={broadcastMsg}
                onChange={(e) => setBroadcastMsg(e.target.value)}
                className="bg-secondary border-border min-h-[120px] mb-4"
              />
              {broadcasting && (
                <div className="mb-4">
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>Sending...</span>
                    <span>{broadcastSent} / {allUsers.filter((u: any) => u.telegram_id !== 0).length}</span>
                  </div>
                  <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${(broadcastSent / Math.max(allUsers.filter((u: any) => u.telegram_id !== 0).length, 1)) * 100}%` }}
                    />
                  </div>
                </div>
              )}
              <Button
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-glow"
                onClick={handleBroadcast}
                disabled={broadcasting || !broadcastMsg.trim()}
              >
                {broadcasting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                {broadcasting ? `Sending (${broadcastSent})...` : "Send to All Users"}
              </Button>
            </Card>

            <Card className="gradient-card border-border/50 p-4">
              <h4 className="font-medium text-foreground mb-3 text-sm">Auto-notifications</h4>
              <div className="space-y-2 text-xs text-muted-foreground">
                <p className="flex items-center gap-2"><CheckCircle className="w-3 h-3 text-emerald-400" /> New activity created — all users notified</p>
                <p className="flex items-center gap-2"><CheckCircle className="w-3 h-3 text-emerald-400" /> New hackathon posted — all users notified</p>
                <p className="flex items-center gap-2"><CheckCircle className="w-3 h-3 text-emerald-400" /> Redemption approved/rejected — user notified</p>
                <p className="flex items-center gap-2"><CheckCircle className="w-3 h-3 text-emerald-400" /> Proof approved/rejected — user notified</p>
                <p className="flex items-center gap-2"><CheckCircle className="w-3 h-3 text-emerald-400" /> Transfer received — recipient notified</p>
                <p className="flex items-center gap-2"><CheckCircle className="w-3 h-3 text-emerald-400" /> Referral used — referrer notified</p>
              </div>
            </Card>
          </motion.div>
        </TabsContent>
      </Tabs>

      {/* ========== REDEMPTION ACTION MODAL ========== */}
      <AnimatePresence>
        {redeemAction && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-end justify-center" onClick={() => setRedeemAction(null)}>
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 300 }} className="w-full max-w-md bg-card border-t border-border rounded-t-2xl p-6 pb-16" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-foreground text-lg">
                  {redeemAction.action === "approved" ? "Approve" : "Reject"} Request
                </h3>
                <Button size="icon" variant="ghost" aria-label="Close" onClick={() => setRedeemAction(null)}><X className="w-4 h-4" /></Button>
              </div>
              {redeemAction.action === "rejected" && (
                <p className="text-sm text-muted-foreground mb-3">The user will be refunded.</p>
              )}
              <Textarea placeholder="Add a note (optional)" value={redeemNotes} onChange={(e) => setRedeemNotes(e.target.value)} className="mb-4 bg-secondary border-border" />
              <Button className={`w-full ${redeemAction.action === "approved" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-destructive hover:bg-destructive/90"} text-white`} onClick={handleProcessRedemption} disabled={processRedemptionMutation.isPending}>
                {processRedemptionMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : redeemAction.action === "approved" ? <CheckCircle className="w-4 h-4 mr-2" /> : <XCircle className="w-4 h-4 mr-2" />}
                Confirm {redeemAction.action === "approved" ? "Approval" : "Rejection"}
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ========== DELETE USER CONFIRMATION MODAL ========== */}
      <AnimatePresence>
        {deleteUserTarget && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-end justify-center" onClick={() => setDeleteUserTarget(null)}>
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 300 }} className="w-full max-w-md bg-card border-t border-border rounded-t-2xl p-6 pb-16" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-destructive text-lg">Delete User</h3>
                <Button size="icon" variant="ghost" aria-label="Close" onClick={() => setDeleteUserTarget(null)}><X className="w-4 h-4" /></Button>
              </div>
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 mb-4">
                <p className="text-sm text-foreground font-medium mb-1">
                  {[deleteUserTarget.first_name, deleteUserTarget.last_name].filter(Boolean).join(" ")}
                </p>
                {deleteUserTarget.username && <p className="text-xs text-muted-foreground mb-1">@{deleteUserTarget.username}</p>}
                <p className="text-xs text-muted-foreground">Balance: {deleteUserTarget.balance.toLocaleString()} DR</p>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                This will permanently delete this user and all their data (transactions, check-ins, activity logs, achievements). Their balance will be returned to the treasury. This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setDeleteUserTarget(null)}>Cancel</Button>
                <Button className="flex-1 bg-destructive hover:bg-destructive/90 text-white" onClick={handleDeleteUser} disabled={deleteUserMutation.isPending}>
                  {deleteUserMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <UserX className="w-4 h-4 mr-2" />}
                  Delete User
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ========== BALANCE ADJUSTMENT MODAL ========== */}
      <AnimatePresence>
        {adjustUser && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-end justify-center" onClick={() => setAdjustUser(null)}>
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 300 }} className="w-full max-w-md bg-card border-t border-border rounded-t-2xl p-6 pb-16" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-foreground text-lg">Adjust Balance</h3>
                <Button size="icon" variant="ghost" aria-label="Close" onClick={() => setAdjustUser(null)}><X className="w-4 h-4" /></Button>
              </div>
              <p className="text-sm text-foreground mb-1">{[adjustUser.first_name, adjustUser.last_name].filter(Boolean).join(" ")}</p>
              <p className="text-sm text-muted-foreground mb-4">Current balance: <span className="text-primary font-semibold">{adjustUser.balance.toLocaleString()} DR</span></p>
              <Input type="number" placeholder="Amount (positive to add, negative to deduct)" value={adjustAmount} onChange={(e) => setAdjustAmount(e.target.value)} className="mb-3 bg-secondary border-border" />
              <Input placeholder="Reason for adjustment" value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} className="mb-4 bg-secondary border-border" />
              <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-glow" onClick={handleAdjustBalance} disabled={!adjustAmount || !adjustReason || adjustBalanceMutation.isPending}>
                {adjustBalanceMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Coins className="w-4 h-4 mr-2" />}
                Adjust Balance
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
