import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useUser } from "@/contexts/UserContext";

// ============================================================
// HEARTBEAT — updates last_active every 60s
// ============================================================

export function useHeartbeat() {
  const { dbUser } = useUser();

  useEffect(() => {
    if (!dbUser?.id) return;

    const ping = () => {
      supabase
        .from("users")
        .update({ last_active: new Date().toISOString() })
        .eq("id", dbUser.id)
        .then(() => {});
    };

    // Ping immediately on mount
    ping();

    // Then every 60 seconds
    const interval = setInterval(ping, 60000);
    return () => clearInterval(interval);
  }, [dbUser?.id]);
}

export function isUserOnline(lastActive: string | null): boolean {
  if (!lastActive) return false;
  const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
  return new Date(lastActive).getTime() > fiveMinutesAgo;
}

// ============================================================
// INACTIVITY PENALTY
// ============================================================

export function useInactivityCheck() {
  const { dbUser, refreshUser } = useUser();

  useEffect(() => {
    if (!dbUser?.id) return;
    const key = `inactivity_check_${new Date().toISOString().split("T")[0]}`;
    if (localStorage.getItem(key)) return;

    const check = async () => {
      const { data, error } = await supabase.rpc("apply_inactivity_penalty", {
        p_user_id: dbUser.id,
      });
      if (error) return;
      localStorage.setItem(key, "checked");
      if (data?.penalty > 0) {
        refreshUser();
      }
      // Send Telegram warning for 30-day inactive users
      if (data?.warning === "30_day_warning" && dbUser.telegram_id) {
        supabase.functions.invoke("send-notification", {
          body: {
            telegram_id: dbUser.telegram_id,
            message: `🚨 <b>Account Warning!</b>\n\nYou've been inactive for ${data.days_inactive} days.\n\n-${data.penalty} DR has been deducted.\n\nYour account may be flagged for deletion if you remain inactive. Open the app and check in now!`,
          },
        }).catch(() => {});
      }
    };

    check();
  }, [dbUser?.id]);
}

// ============================================================
// BIRTHDAYS
// ============================================================

export function useSetBirthday() {
  const { dbUser, refreshUser } = useUser();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (birthday: string | null) => {
      if (!dbUser) throw new Error("Not logged in");
      const { error } = await supabase
        .from("users")
        .update({ birthday })
        .eq("id", dbUser.id);
      if (error) throw error;
    },
    onSuccess: () => {
      refreshUser();
      queryClient.invalidateQueries({ queryKey: ["todays_birthdays"] });
    },
  });
}

export function useTodaysBirthdays() {
  return useQuery({
    queryKey: ["todays_birthdays"],
    queryFn: async () => {
      const today = new Date();
      const month = today.getMonth() + 1;
      const day = today.getDate();
      // Supabase doesn't support EXTRACT in filters, so fetch all users with birthdays and filter client-side
      const { data, error } = await supabase
        .from("users")
        .select("id, first_name, last_name, username, photo_url, birthday, last_active")
        .not("birthday", "is", null);
      if (error) throw error;
      return (data || []).filter((u: any) => {
        const bday = new Date(u.birthday);
        return bday.getMonth() + 1 === month && bday.getDate() === day;
      });
    },
    refetchInterval: 60000,
  });
}

export function useUserProfile(userId: string | null) {
  return useQuery({
    queryKey: ["user_profile", userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from("users")
        .select("id, first_name, last_name, username, photo_url, balance, total_earned, streak, status, state_id, created_at, last_active, birthday")
        .eq("id", userId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      // Get state name
      let stateName = null;
      if (data.state_id) {
        const { data: state } = await supabase
          .from("states")
          .select("name")
          .eq("id", data.state_id)
          .maybeSingle();
        stateName = state?.name;
      }
      // Get referral count
      const { count: referralCount } = await supabase
        .from("referrals")
        .select("*", { count: "exact", head: true })
        .eq("referrer_id", data.id);
      // Get achievements
      const { data: achievements } = await supabase
        .from("user_achievements")
        .select("*, achievement:achievement_id(name, icon, description)")
        .eq("user_id", data.id);
      return { ...data, state_name: stateName, referral_count: referralCount ?? 0, achievements: achievements || [] };
    },
    enabled: !!userId,
  });
}

// ============================================================
// TOKEN SUPPLY
// ============================================================

export function useTokenSupply() {
  return useQuery({
    queryKey: ["token_supply"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("token_supply")
        .select("*")
        .eq("id", 1)
        .single();
      if (error) throw error;
      return data;
    },
    refetchInterval: 30000,
  });
}

export function useAdminAuditLog() {
  return useQuery({
    queryKey: ["admin_audit_log"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_audit_log")
        .select("*, users!admin_audit_log_admin_id_fkey(first_name, username)")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });
}

// ============================================================
// ACTIVITIES
// ============================================================

export function useActivities() {
  return useQuery({
    queryKey: ["activities"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activities")
        .select("*")
        .eq("is_active", true)
        .order("date", { ascending: false });
      if (error) throw error;
      // Fetch participant count for each activity
      const withCounts = await Promise.all(
        (data || []).map(async (act: any) => {
          const { count } = await supabase
            .from("activity_logs")
            .select("*", { count: "exact", head: true })
            .eq("activity_id", act.id);
          return { ...act, participant_count: count ?? 0 };
        })
      );
      return withCounts;
    },
  });
}

export function useAllActivitiesAdmin() {
  return useQuery({
    queryKey: ["admin_activities"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activities")
        .select("*")
        .order("date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useUserActivityLogs() {
  const { dbUser } = useUser();
  return useQuery({
    queryKey: ["activity_logs", dbUser?.id],
    queryFn: async () => {
      if (!dbUser) return [];
      const { data, error } = await supabase
        .from("activity_logs")
        .select("activity_id")
        .eq("user_id", dbUser.id);
      if (error) throw error;
      return data.map((log) => log.activity_id);
    },
    enabled: !!dbUser,
  });
}

export function useActivityParticipants(activityId: string | null) {
  return useQuery({
    queryKey: ["activity_participants", activityId],
    queryFn: async () => {
      if (!activityId) return [];
      const { data, error } = await supabase
        .from("activity_logs")
        .select("*")
        .eq("activity_id", activityId)
        .order("logged_at", { ascending: false });
      if (error) throw error;
      const withUsers = await Promise.all(
        (data || []).map(async (log: any) => {
          const { data: user } = await supabase
            .from("users")
            .select("first_name, last_name, username")
            .eq("id", log.user_id)
            .maybeSingle();
          return { ...log, user };
        })
      );
      return withUsers;
    },
    enabled: !!activityId,
  });
}

export function useLogActivity() {
  const { dbUser, refreshUser } = useUser();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ code, proofUrl }: { code: string; proofUrl?: string }) => {
      if (!dbUser) throw new Error("Not logged in");
      const { data, error } = await supabase.rpc("log_activity", {
        p_user_id: dbUser.id,
        p_code: code,
        p_proof_url: proofUrl || null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      refreshUser();
      queryClient.invalidateQueries({ queryKey: ["activity_logs"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
    },
  });
}

// ============================================================
// DAILY CHECK-IN
// ============================================================

export function useTodayCheckin() {
  const { dbUser } = useUser();
  return useQuery({
    queryKey: ["checkin_today", dbUser?.id],
    queryFn: async () => {
      if (!dbUser) return false;
      const today = new Date().toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("daily_checkins")
        .select("id")
        .eq("user_id", dbUser.id)
        .eq("check_in_date", today)
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
    enabled: !!dbUser,
  });
}

export function usePerformCheckin() {
  const { dbUser, refreshUser } = useUser();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!dbUser) throw new Error("Not logged in");
      const { data, error } = await supabase.rpc("perform_daily_checkin", {
        p_user_id: dbUser.id,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      refreshUser();
      queryClient.invalidateQueries({ queryKey: ["checkin_today"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
    },
  });
}

// ============================================================
// HACKATHONS
// ============================================================

export function useHackathons() {
  return useQuery({
    queryKey: ["hackathons"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hackathons")
        .select("*")
        .eq("is_active", true)
        .order("start_date", { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}

export function useUserHackathonRegistrations() {
  const { dbUser } = useUser();
  return useQuery({
    queryKey: ["hackathon_registrations", dbUser?.id],
    queryFn: async () => {
      if (!dbUser) return [];
      const { data, error } = await supabase
        .from("hackathon_registrations")
        .select("hackathon_id")
        .eq("user_id", dbUser.id);
      if (error) throw error;
      return data.map((r) => r.hackathon_id);
    },
    enabled: !!dbUser,
  });
}

export function useRegisterHackathon() {
  const { dbUser, refreshUser } = useUser();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (hackathonId: string) => {
      if (!dbUser) throw new Error("Not logged in");
      const { data, error } = await supabase.rpc("register_hackathon", {
        p_user_id: dbUser.id,
        p_hackathon_id: hackathonId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      refreshUser();
      queryClient.invalidateQueries({ queryKey: ["hackathon_registrations"] });
      queryClient.invalidateQueries({ queryKey: ["hackathons"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
    },
  });
}

// ============================================================
// RAFFLES
// ============================================================

export function useRaffles() {
  return useQuery({
    queryKey: ["raffles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("raffles")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      // Fetch winner names and entry counts
      const withExtras = await Promise.all(
        (data || []).map(async (r: any) => {
          const { count } = await supabase
            .from("raffle_entries")
            .select("*", { count: "exact", head: true })
            .eq("raffle_id", r.id);
          if (r.winner_id) {
            const { data: winner } = await supabase
              .from("users")
              .select("first_name, username")
              .eq("id", r.winner_id)
              .maybeSingle();
            return { ...r, winner, entry_count: count ?? 0 };
          }
          return { ...r, winner: null, entry_count: count ?? 0 };
        })
      );
      return withExtras;
    },
  });
}

export function useRaffleEntries(raffleId: string | null) {
  return useQuery({
    queryKey: ["raffle_entries", raffleId],
    queryFn: async () => {
      if (!raffleId) return [];
      const { data, error } = await supabase
        .from("raffle_entries")
        .select("*")
        .eq("raffle_id", raffleId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      // Fetch user info for each entry
      const withUsers = await Promise.all(
        (data || []).map(async (e: any) => {
          const { data: user } = await supabase
            .from("users")
            .select("first_name, last_name, username")
            .eq("id", e.user_id)
            .maybeSingle();
          return { ...e, user };
        })
      );
      return withUsers;
    },
    enabled: !!raffleId,
  });
}

export function useUserRaffleEntries() {
  const { dbUser } = useUser();
  return useQuery({
    queryKey: ["user_raffle_entries", dbUser?.id],
    queryFn: async () => {
      if (!dbUser) return [];
      const { data, error } = await supabase
        .from("raffle_entries")
        .select("raffle_id")
        .eq("user_id", dbUser.id);
      if (error) throw error;
      return data.map((r) => r.raffle_id);
    },
    enabled: !!dbUser,
  });
}

export function useEnterRaffle() {
  const { dbUser, refreshUser } = useUser();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (raffleId: string) => {
      if (!dbUser) throw new Error("Not logged in");
      const { data, error } = await supabase.rpc("enter_raffle", {
        p_user_id: dbUser.id,
        p_raffle_id: raffleId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      refreshUser();
      queryClient.invalidateQueries({ queryKey: ["user_raffle_entries"] });
      queryClient.invalidateQueries({ queryKey: ["raffles"] });
      queryClient.invalidateQueries({ queryKey: ["raffle_entries"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
  });
}

export function useCreateRaffle() {
  const queryClient = useQueryClient();
  const { dbUser } = useUser();

  return useMutation({
    mutationFn: async (raffle: { title: string; description?: string; entry_fee: number; end_date: string; max_entries?: number }) => {
      const { data, error } = await supabase
        .from("raffles")
        .insert({ ...raffle, created_by: dbUser?.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["raffles"] });
    },
  });
}

export function useDeleteRaffle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (raffleId: string) => {
      const { error } = await supabase
        .from("raffles")
        .update({ is_active: false })
        .eq("id", raffleId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["raffles"] });
    },
  });
}

export function useDrawRaffleWinner() {
  const { dbUser } = useUser();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (raffleId: string) => {
      if (!dbUser) throw new Error("Not logged in");
      const { data, error } = await supabase.rpc("draw_raffle_winner", {
        p_admin_id: dbUser.id,
        p_raffle_id: raffleId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["raffles"] });
      queryClient.invalidateQueries({ queryKey: ["raffle_entries"] });
    },
  });
}

// ============================================================
// STREAK INSURANCE
// ============================================================

// ============================================================
// PROMO CODES
// ============================================================

export function useClaimPromoCode() {
  const { dbUser, refreshUser } = useUser();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (code: string) => {
      if (!dbUser) throw new Error("Not logged in");
      const { data, error } = await supabase.rpc("claim_promo_code", {
        p_user_id: dbUser.id,
        p_code: code,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      refreshUser();
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
  });
}

export function useAllPromoCodes() {
  return useQuery({
    queryKey: ["admin_promo_codes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("promo_codes")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      // Fetch claimed_by user info
      const withUsers = await Promise.all(
        (data || []).map(async (p: any) => {
          if (p.claimed_by) {
            const { data: user } = await supabase
              .from("users")
              .select("first_name, username")
              .eq("id", p.claimed_by)
              .maybeSingle();
            return { ...p, claimed_user: user };
          }
          return { ...p, claimed_user: null };
        })
      );
      return withUsers;
    },
  });
}

export function useCreatePromoCode() {
  const { dbUser } = useUser();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ code, reward, description }: { code: string; reward: number; description?: string }) => {
      const { data, error } = await supabase
        .from("promo_codes")
        .insert({ code: code.toUpperCase().trim(), reward, description, created_by: dbUser?.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_promo_codes"] });
    },
  });
}

export function useGeneratePromoCodes() {
  const { dbUser } = useUser();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ count, reward, description }: { count: number; reward: number; description?: string }) => {
      const codes = [];
      for (let i = 0; i < count; i++) {
        const code = "BREATH-" + Math.random().toString(36).substring(2, 6).toUpperCase();
        codes.push({ code, reward, description, created_by: dbUser?.id });
      }
      const { data, error } = await supabase
        .from("promo_codes")
        .insert(codes)
        .select();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_promo_codes"] });
    },
  });
}

// ============================================================
// STREAK INSURANCE
// ============================================================

export function useBuyStreakInsurance() {
  const { dbUser, refreshUser } = useUser();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!dbUser) throw new Error("Not logged in");
      const { data, error } = await supabase.rpc("buy_streak_insurance", {
        p_user_id: dbUser.id,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      refreshUser();
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
  });
}

// ============================================================
// TRANSACTIONS
// ============================================================

export function useTransactions(limit?: number, typeFilter?: string) {
  const { dbUser } = useUser();
  return useQuery({
    queryKey: ["transactions", dbUser?.id, limit, typeFilter],
    queryFn: async () => {
      if (!dbUser) return [];
      let query = supabase
        .from("transactions")
        .select("*")
        .eq("user_id", dbUser.id)
        .order("created_at", { ascending: false });
      if (typeFilter && typeFilter !== "all") {
        query = query.eq("type", typeFilter);
      }
      if (limit) query = query.limit(limit);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!dbUser,
  });
}

// ============================================================
// TRANSFER
// ============================================================

export function useTransferDR() {
  const { dbUser, refreshUser } = useUser();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ recipientUsername, amount, note }: { recipientUsername: string; amount: number; note?: string }) => {
      if (!dbUser) throw new Error("Not logged in");
      const { data, error } = await supabase.rpc("transfer_dr", {
        p_sender_id: dbUser.id,
        p_recipient_username: recipientUsername,
        p_amount: amount,
        p_note: note || null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      refreshUser();
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
    },
  });
}

// ============================================================
// LEADERBOARD
// ============================================================

export function useLeaderboard(limit = 20) {
  return useQuery({
    queryKey: ["leaderboard", limit],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_leaderboard", { p_limit: limit });
      if (error) throw error;
      return data;
    },
    refetchInterval: 15000,
  });
}

// ============================================================
// MISSIONS
// ============================================================

export function useMissions() {
  return useQuery({
    queryKey: ["missions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("missions")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useAllMissionsAdmin() {
  return useQuery({
    queryKey: ["admin_missions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("missions")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useUserMissionCompletions() {
  const { dbUser } = useUser();
  return useQuery({
    queryKey: ["mission_completions", dbUser?.id],
    queryFn: async () => {
      if (!dbUser) return [];
      const { data, error } = await supabase
        .from("mission_completions")
        .select("mission_id")
        .eq("user_id", dbUser.id);
      if (error) throw error;
      return data.map((c) => c.mission_id);
    },
    enabled: !!dbUser,
  });
}

export function useCompleteMission() {
  const { dbUser, refreshUser } = useUser();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ missionId, code }: { missionId: string; code?: string }) => {
      if (!dbUser) throw new Error("Not logged in");
      const { data, error } = await supabase.rpc("complete_mission", {
        p_user_id: dbUser.id,
        p_mission_id: missionId,
        p_code: code || null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      refreshUser();
      queryClient.invalidateQueries({ queryKey: ["mission_completions"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
    },
  });
}

export function useUserMissionUnlocks() {
  const { dbUser } = useUser();
  return useQuery({
    queryKey: ["mission_unlocks", dbUser?.id],
    queryFn: async () => {
      if (!dbUser) return [];
      const { data, error } = await supabase
        .from("mission_unlocks")
        .select("mission_id")
        .eq("user_id", dbUser.id);
      if (error) throw error;
      return data.map((u) => u.mission_id);
    },
    enabled: !!dbUser,
  });
}

export function useUnlockMission() {
  const { dbUser, refreshUser } = useUser();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (missionId: string) => {
      if (!dbUser) throw new Error("Not logged in");
      const { data, error } = await supabase.rpc("unlock_mission", {
        p_user_id: dbUser.id,
        p_mission_id: missionId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      refreshUser();
      queryClient.invalidateQueries({ queryKey: ["mission_unlocks"] });
      queryClient.invalidateQueries({ queryKey: ["missions"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
  });
}

export function useCreateMission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (mission: { title: string; description?: string; category: string; reward: number; unlock_fee: number; completion_code?: string; expires_at?: string }) => {
      const { data, error } = await supabase
        .from("missions")
        .insert(mission)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["missions"] });
    },
  });
}

export function useDeleteMission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (missionId: string) => {
      const { error } = await supabase
        .from("missions")
        .update({ is_active: false })
        .eq("id", missionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["missions"] });
      queryClient.invalidateQueries({ queryKey: ["admin_missions"] });
    },
  });
}

export function useUnarchiveMission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (missionId: string) => {
      const { error } = await supabase
        .from("missions")
        .update({ is_active: true })
        .eq("id", missionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["missions"] });
      queryClient.invalidateQueries({ queryKey: ["admin_missions"] });
    },
  });
}

export function useMissionParticipants(missionId: string | null) {
  return useQuery({
    queryKey: ["mission_participants", missionId],
    queryFn: async () => {
      if (!missionId) return { unlocked: [], completed: [] };
      // Fetch unlocks
      const { data: unlocks, error: uErr } = await supabase
        .from("mission_unlocks")
        .select("*")
        .eq("mission_id", missionId)
        .order("created_at", { ascending: false });
      if (uErr) throw uErr;
      // Fetch completions
      const { data: completions, error: cErr } = await supabase
        .from("mission_completions")
        .select("*")
        .eq("mission_id", missionId)
        .order("completed_at", { ascending: false });
      if (cErr) throw cErr;
      const completedUserIds = new Set((completions || []).map((c: any) => c.user_id));
      // Fetch user info for all unique user IDs
      const allUserIds = [...new Set([...(unlocks || []).map((u: any) => u.user_id), ...(completions || []).map((c: any) => c.user_id)])];
      const userMap: Record<string, any> = {};
      await Promise.all(
        allUserIds.map(async (uid) => {
          const { data: user } = await supabase
            .from("users")
            .select("first_name, last_name, username")
            .eq("id", uid)
            .maybeSingle();
          if (user) userMap[uid] = user;
        })
      );
      return {
        unlocked: (unlocks || []).map((u: any) => ({
          ...u,
          user: userMap[u.user_id],
          completed: completedUserIds.has(u.user_id),
        })),
        completed: (completions || []).map((c: any) => ({ ...c, user: userMap[c.user_id] })),
      };
    },
    enabled: !!missionId,
  });
}

// ============================================================
// REFERRALS
// ============================================================

export function useProcessReferral() {
  const { dbUser, refreshUser } = useUser();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (referralCode: string) => {
      if (!dbUser) throw new Error("Not logged in");
      const { data, error } = await supabase.rpc("process_referral", {
        p_referred_user_id: dbUser.id,
        p_referral_code: referralCode,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      refreshUser();
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
  });
}

export function useUserReferralCount() {
  const { dbUser } = useUser();
  return useQuery({
    queryKey: ["referral_count", dbUser?.id],
    queryFn: async () => {
      if (!dbUser) return 0;
      const { count, error } = await supabase
        .from("referrals")
        .select("*", { count: "exact", head: true })
        .eq("referrer_id", dbUser.id);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!dbUser,
  });
}

export function useAllReferrals() {
  return useQuery({
    queryKey: ["admin_referrals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("referrals")
        .select(`
          id,
          created_at,
          referrer:referrer_id(id, first_name, last_name, username),
          referred:referred_id(id, first_name, last_name, username)
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useReferredBy() {
  const { dbUser } = useUser();
  return useQuery({
    queryKey: ["referred_by", dbUser?.id],
    queryFn: async () => {
      if (!dbUser) return null;
      const { data, error } = await supabase
        .from("referrals")
        .select("referrer_id")
        .eq("referred_id", dbUser.id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      // Fetch referrer's name
      const { data: referrer, error: userError } = await supabase
        .from("users")
        .select("first_name, last_name, username")
        .eq("id", data.referrer_id)
        .single();
      if (userError) throw userError;
      return referrer;
    },
    enabled: !!dbUser,
  });
}

// ============================================================
// ACHIEVEMENTS
// ============================================================

export function useAchievements() {
  return useQuery({
    queryKey: ["achievements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("achievements")
        .select("*")
        .order("condition_value", { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}

export function useUserAchievements() {
  const { dbUser } = useUser();
  return useQuery({
    queryKey: ["user_achievements", dbUser?.id],
    queryFn: async () => {
      if (!dbUser) return [];
      const { data, error } = await supabase
        .from("user_achievements")
        .select("achievement_id")
        .eq("user_id", dbUser.id);
      if (error) throw error;
      return data.map((a) => a.achievement_id);
    },
    enabled: !!dbUser,
  });
}

export function useCheckAchievements() {
  const { dbUser, refreshUser } = useUser();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!dbUser) throw new Error("Not logged in");
      const { data, error } = await supabase.rpc("check_achievements", {
        p_user_id: dbUser.id,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      refreshUser();
      queryClient.invalidateQueries({ queryKey: ["user_achievements"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
  });
}

// ============================================================
// REDEMPTION CATEGORIES (admin-editable costs)
// ============================================================

export function useRedemptionCategories() {
  return useQuery({
    queryKey: ["redemption_categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("redemption_categories")
        .select("*")
        .order("id");
      if (error) throw error;
      return data;
    },
  });
}

export function useUpdateRedemptionCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, cost, description, is_active }: { id: string; cost?: number; description?: string; is_active?: boolean }) => {
      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (cost !== undefined) updates.cost = cost;
      if (description !== undefined) updates.description = description;
      if (is_active !== undefined) updates.is_active = is_active;
      const { error } = await supabase
        .from("redemption_categories")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["redemption_categories"] });
    },
  });
}

// ============================================================
// MENTORS
// ============================================================

export function useMentors() {
  return useQuery({
    queryKey: ["mentors"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mentors")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });
}

export function useAllMentors() {
  return useQuery({
    queryKey: ["all_mentors"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mentors")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateMentor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (mentor: { name: string; specialty: string; contact_info: string }) => {
      const { data, error } = await supabase
        .from("mentors")
        .insert(mentor)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mentors"] });
      queryClient.invalidateQueries({ queryKey: ["all_mentors"] });
    },
  });
}

export function useUpdateMentor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; name?: string; specialty?: string; contact_info?: string; is_active?: boolean }) => {
      const { data, error } = await supabase
        .from("mentors")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mentors"] });
      queryClient.invalidateQueries({ queryKey: ["all_mentors"] });
    },
  });
}

export function useDeleteMentor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("mentors").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mentors"] });
      queryClient.invalidateQueries({ queryKey: ["all_mentors"] });
    },
  });
}

// ============================================================
// REDEMPTIONS
// ============================================================

export function useSubmitRedemption() {
  const { dbUser, refreshUser } = useUser();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      category,
      amount,
      details,
    }: {
      category: string;
      amount: number;
      details: Record<string, unknown>;
    }) => {
      if (!dbUser) throw new Error("Not logged in");
      const { data, error } = await supabase.rpc("submit_redemption", {
        p_user_id: dbUser.id,
        p_category: category,
        p_amount: amount,
        p_details: details,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      refreshUser();
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
    },
  });
}

// ============================================================
// USER REDEMPTION HISTORY
// ============================================================

export function useUserRedemptions() {
  const { dbUser } = useUser();
  return useQuery({
    queryKey: ["user_redemptions", dbUser?.id],
    queryFn: async () => {
      if (!dbUser) return [];
      const { data, error } = await supabase.rpc("get_user_redemptions", {
        p_user_id: dbUser.id,
      });
      if (error) throw error;
      return data;
    },
    enabled: !!dbUser,
  });
}

// ============================================================
// ADMIN: Create Activity
// ============================================================

export function useCreateActivity() {
  const { dbUser } = useUser();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (activity: {
      title: string;
      description?: string;
      category: string;
      date: string;
      reward: number;
      code: string;
      max_participants?: number;
      code_required?: boolean;
      proof_required?: boolean;
    }) => {
      if (!dbUser) throw new Error("Not logged in");
      const { data, error } = await supabase
        .from("activities")
        .insert({
          ...activity,
          created_by: dbUser.id,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activities"] });
    },
  });
}

// ============================================================
// ADMIN: Update Activity
// ============================================================

export function useUpdateActivity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; title?: string; description?: string; category?: string; date?: string; reward?: number; is_active?: boolean }) => {
      const { data, error } = await supabase
        .from("activities")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activities"] });
    },
  });
}

// ============================================================
// ADMIN: Delete Activity
// ============================================================

export function useDeleteActivity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("activities")
        .update({ is_active: false })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activities"] });
      queryClient.invalidateQueries({ queryKey: ["admin_activities"] });
    },
  });
}

export function useToggleActivityStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("activities")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activities"] });
      queryClient.invalidateQueries({ queryKey: ["admin_activities"] });
    },
  });
}

// ============================================================
// ADMIN: Create Hackathon
// ============================================================

export function useCreateHackathon() {
  const { dbUser } = useUser();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (hackathon: {
      title: string;
      description?: string;
      start_date: string;
      end_date: string;
      entry_fee: number;
      prize_pool: number;
      max_teams?: number;
      cover_image_url?: string;
    }) => {
      if (!dbUser) throw new Error("Not logged in");
      const { data, error } = await supabase
        .from("hackathons")
        .insert({
          ...hackathon,
          created_by: dbUser.id,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hackathons"] });
    },
  });
}

// ============================================================
// ADMIN: Update Hackathon
// ============================================================

export function useUpdateHackathon() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; title?: string; description?: string; start_date?: string; end_date?: string; entry_fee?: number; prize_pool?: number; max_teams?: number; status?: string; is_active?: boolean }) => {
      const { data, error } = await supabase
        .from("hackathons")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hackathons"] });
    },
  });
}

// ============================================================
// ADMIN: Delete Hackathon
// ============================================================

export function useDeleteHackathon() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("hackathons").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hackathons"] });
    },
  });
}

// ============================================================
// ADMIN: Redemption Requests
// ============================================================

export function useRedemptionRequests() {
  return useQuery({
    queryKey: ["redemption_requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("redemption_requests")
        .select("*, users!redemption_requests_user_id_fkey(first_name, last_name, username, telegram_id)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useProcessRedemption() {
  const { dbUser } = useUser();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ requestId, action, notes }: { requestId: string; action: "approved" | "rejected"; notes?: string }) => {
      if (!dbUser) throw new Error("Not logged in");
      const { data, error } = await supabase.rpc("process_redemption", {
        p_admin_id: dbUser.id,
        p_request_id: requestId,
        p_action: action,
        p_notes: notes || null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["redemption_requests"] });
    },
  });
}

// ============================================================
// ADMIN: User Management
// ============================================================

export function useAllUsers() {
  return useQuery({
    queryKey: ["admin_users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useAdjustBalance() {
  const { dbUser } = useUser();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, amount, reason }: { userId: string; amount: number; reason: string }) => {
      if (!dbUser) throw new Error("Not logged in");
      const { data, error } = await supabase.rpc("admin_adjust_balance", {
        p_admin_id: dbUser.id,
        p_user_id: userId,
        p_amount: amount,
        p_reason: reason,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_users"] });
      queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
    },
  });
}

export function useDeleteUser() {
  const { dbUser } = useUser();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId }: { userId: string }) => {
      if (!dbUser) throw new Error("Not logged in");
      const { data, error } = await supabase.rpc("admin_delete_user", {
        p_admin_id: dbUser.id,
        p_user_id: userId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_users"] });
      queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
      queryClient.invalidateQueries({ queryKey: ["state_rankings"] });
    },
  });
}

// ============================================================
// STATES
// ============================================================

export function useStates() {
  return useQuery({
    queryKey: ["states"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("states")
        .select("*")
        .order("name");
      if (error) throw error;
      return data;
    },
  });
}

export function useStateMembers(stateId: string | null) {
  return useQuery({
    queryKey: ["state_members", stateId],
    queryFn: async () => {
      if (!stateId) return [];
      const { data, error } = await supabase
        .from("users")
        .select("id, first_name, last_name, username, photo_url, balance, total_earned, status, last_active")
        .eq("state_id", stateId)
        .order("balance", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!stateId,
  });
}

export function useStateRankings() {
  return useQuery({
    queryKey: ["state_rankings"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_state_rankings");
      if (error) throw error;
      return data;
    },
    refetchInterval: 30000,
  });
}

export function useJoinState() {
  const { dbUser, refreshUser } = useUser();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (stateId: string) => {
      if (!dbUser) throw new Error("Not logged in");
      const { data, error } = await supabase.rpc("join_state", {
        p_user_id: dbUser.id,
        p_state_id: stateId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      refreshUser();
      queryClient.invalidateQueries({ queryKey: ["state_rankings"] });
    },
  });
}

export function useCreateState() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase
        .from("states")
        .insert({ name })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["states"] });
      queryClient.invalidateQueries({ queryKey: ["state_rankings"] });
    },
  });
}

export function useDeleteState() {
  const { dbUser } = useUser();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (stateId: string) => {
      if (!dbUser) throw new Error("Not logged in");
      const { data, error } = await supabase.rpc("delete_state", {
        p_admin_id: dbUser.id,
        p_state_id: stateId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["states"] });
      queryClient.invalidateQueries({ queryKey: ["state_rankings"] });
    },
  });
}
