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
  useHackathons,
  useCreateHackathon,
  useUpdateHackathon,
  useDeleteHackathon,
  useRedemptionRequests,
  useProcessRedemption,
  useAllUsers,
  useAdjustBalance,
} from "@/hooks/useSupabase";
import { useUser } from "@/contexts/UserContext";
import { supabase } from "@/lib/supabase";
import { uploadImage } from "@/lib/storage";
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
} from "lucide-react";

export default function Admin() {
  const { toast } = useToast();
  const { dbUser } = useUser();
  const queryClient = useQueryClient();

  // Data hooks
  const { data: activities = [] } = useActivities();
  const { data: hackathons = [] } = useHackathons();
  const { data: redemptions = [] } = useRedemptionRequests();
  const { data: allUsers = [] } = useAllUsers();

  // Pending proofs query
  const { data: pendingProofs = [] } = useQuery({
    queryKey: ["pending_proofs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity_logs")
        .select("*, activities(title, reward), users!activity_logs_user_id_fkey(first_name, last_name, username)")
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

  // Activity form
  const [actTitle, setActTitle] = useState("");
  const [actDesc, setActDesc] = useState("");
  const [actDate, setActDate] = useState("");
  const [actReward, setActReward] = useState("");
  const [actCategory, setActCategory] = useState("meeting");
  const [editingActivity, setEditingActivity] = useState<any | null>(null);
  const [actCodeRequired, setActCodeRequired] = useState(true);
  const [actProofRequired, setActProofRequired] = useState(false);

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

  // Redemption notes modal
  const [redeemAction, setRedeemAction] = useState<{ id: string; action: "approved" | "rejected" } | null>(null);
  const [redeemNotes, setRedeemNotes] = useState("");

  const generateCode = (title: string) => {
    const slug = title.toUpperCase().replace(/[^A-Z0-9 ]/g, "").split(" ").slice(0, 2).join("-");
    const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${slug}-${suffix}`;
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({ title: "Copied!", description: code });
  };

  // ---- ACTIVITY HANDLERS ----

  const resetActivityForm = () => {
    setActTitle(""); setActDesc(""); setActDate(""); setActReward(""); setActCategory("meeting");
    setEditingActivity(null); setActCodeRequired(true); setActProofRequired(false);
  };

  const handleCreateActivity = async () => {
    if (!actTitle || !actDate || !actReward) {
      toast({ title: "Missing fields", description: "Fill in title, date, and reward.", variant: "destructive" });
      return;
    }
    const code = generateCode(actTitle);
    try {
      await createActivityMutation.mutateAsync({ title: actTitle, description: actDesc || undefined, category: actCategory, date: actDate, reward: parseInt(actReward), code, code_required: actCodeRequired, proof_required: actProofRequired });
      if (actCodeRequired) {
        toast({ title: "Activity Created!", description: `Code: ${code}` });
      } else {
        toast({ title: "Activity Created!", description: "Proof-based activity (no attendance code shown)." });
      }
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
  };

  const handleUpdateActivity = async () => {
    if (!editingActivity || !actTitle || !actDate || !actReward) return;
    try {
      await updateActivityMutation.mutateAsync({
        id: editingActivity.id, title: actTitle, description: actDesc || undefined,
        category: actCategory, date: actDate, reward: parseInt(actReward),
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
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pb-20 px-4 pt-6">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <h1 className="text-2xl font-bold text-foreground mb-2">Admin Panel</h1>
        <p className="text-muted-foreground">Manage activities, hackathons, redemptions, and users</p>
      </motion.div>

      <Tabs defaultValue="activities" className="w-full">
        <TabsList className="grid w-full grid-cols-5 mb-6">
          <TabsTrigger value="activities">Activities</TabsTrigger>
          <TabsTrigger value="hackathons">Hackathons</TabsTrigger>
          <TabsTrigger value="redemptions" className="relative">
            Redeem
            {pendingCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-destructive text-destructive-foreground text-[10px] rounded-full flex items-center justify-center">
                {pendingCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="proofs" className="relative">
            Proofs
            {pendingProofCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-destructive text-destructive-foreground text-[10px] rounded-full flex items-center justify-center">
                {pendingProofCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
        </TabsList>

        {/* ========== ACTIVITIES TAB ========== */}
        <TabsContent value="activities">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="gradient-card border-border/50 p-5 mb-6">
              <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <Plus className="w-4 h-4 text-primary" />
                {editingActivity ? "Edit Activity" : "New Activity"}
              </h3>
              <div className="space-y-3">
                <Input placeholder="Activity title" value={actTitle} onChange={(e) => setActTitle(e.target.value)} className="bg-secondary border-border" />
                <Textarea placeholder="Description (optional)" value={actDesc} onChange={(e) => setActDesc(e.target.value)} className="bg-secondary border-border min-h-[60px]" />
                <Input type="date" value={actDate} onChange={(e) => setActDate(e.target.value)} className="bg-secondary border-border" />
                <Input type="number" placeholder="DR reward amount" value={actReward} onChange={(e) => setActReward(e.target.value)} className="bg-secondary border-border" />
                <select value={actCategory} onChange={(e) => setActCategory(e.target.value)} className="w-full h-10 px-3 rounded-md bg-secondary border border-border text-foreground text-sm">
                  <option value="meeting">Meeting</option>
                  <option value="workshop">Workshop</option>
                  <option value="event">Event</option>
                  <option value="outreach">Outreach</option>
                </select>
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
                <Input placeholder="Hackathon title" value={hackTitle} onChange={(e) => setHackTitle(e.target.value)} className="bg-secondary border-border" />
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
                    </div>
                    <div className="text-right flex items-center gap-2">
                      <div>
                        <p className="text-primary font-bold text-sm">{u.balance.toLocaleString()} DR</p>
                        <p className="text-xs text-muted-foreground">Earned: {u.total_earned.toLocaleString()}</p>
                      </div>
                      <Button size="icon" variant="outline" className="h-8 w-8 border-primary/30" aria-label="Adjust balance" onClick={() => { setAdjustUser(u); setAdjustAmount(""); setAdjustReason(""); }}>
                        <Coins className="w-3.5 h-3.5 text-primary" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </motion.div>
        </TabsContent>
      </Tabs>

      {/* ========== REDEMPTION ACTION MODAL ========== */}
      <AnimatePresence>
        {redeemAction && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end justify-center" onClick={() => setRedeemAction(null)}>
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 300 }} className="w-full max-w-md bg-card border-t border-border rounded-t-2xl p-6" onClick={(e) => e.stopPropagation()}>
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

      {/* ========== BALANCE ADJUSTMENT MODAL ========== */}
      <AnimatePresence>
        {adjustUser && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end justify-center" onClick={() => setAdjustUser(null)}>
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 300 }} className="w-full max-w-md bg-card border-t border-border rounded-t-2xl p-6" onClick={(e) => e.stopPropagation()}>
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
