import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { useTelegram } from "@/contexts/TelegramContext";

interface DbUser {
  id: string;
  telegram_id: number;
  first_name: string;
  last_name: string | null;
  username: string | null;
  photo_url: string | null;
  balance: number;
  total_earned: number;
  streak: number;
  last_check_in: string | null;
  is_admin: boolean;
  is_super_admin: boolean;
  status: string;
  created_at: string;
  referral_code: string | null;
  state_id: string | null;
  streak_protected_until: string | null;
  last_active: string | null;
  birthday: string | null;
  previous_streak: number;
  streak_lost_at: string | null;
  bank_name: string | null;
  account_number: string | null;
  account_name: string | null;
}

interface UserContextValue {
  dbUser: DbUser | null;
  loading: boolean;
  verified: boolean;
  refreshUser: () => Promise<void>;
}

const UserContext = createContext<UserContextValue>({
  dbUser: null,
  loading: true,
  verified: false,
  refreshUser: async () => {},
});

export function UserProvider({ children }: { children: ReactNode }) {
  const { user, initData, isTelegram } = useTelegram();
  const [dbUser, setDbUser] = useState<DbUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [verified, setVerified] = useState(false);

  const validateInitData = async (): Promise<boolean> => {
    // Skip validation in browser dev mode
    if (!isTelegram || !initData) {
      return true;
    }

    try {
      const { data, error } = await supabase.functions.invoke("validate-telegram", {
        body: { initData },
      });

      if (error) {
        console.warn("initData validation failed (edge function):", error);
        // Allow through if edge function not deployed yet
        return true;
      }

      return data?.valid === true;
    } catch (err) {
      console.warn("initData validation unavailable:", err);
      // Gracefully degrade — allow through if function not deployed
      return true;
    }
  };

  const upsertUser = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    // Validate Telegram initData
    const isValid = await validateInitData();
    setVerified(isValid);

    if (!isValid) {
      console.error("Telegram initData validation failed — blocking user creation");
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.rpc("upsert_telegram_user", {
        p_telegram_id: user.id,
        p_first_name: user.firstName,
        p_last_name: user.lastName || null,
        p_username: user.username || null,
        p_photo_url: user.photoUrl || null,
        p_language_code: user.languageCode || "en",
      });

      if (error) throw error;
      setDbUser(data);
    } catch (err) {
      console.error("Failed to upsert user:", err);
      const { data } = await supabase
        .from("users")
        .select("*")
        .eq("telegram_id", user.id)
        .single();
      if (data) setDbUser(data);
    } finally {
      setLoading(false);
    }
  };

  const refreshUser = async () => {
    if (!dbUser) return;
    const { data } = await supabase
      .from("users")
      .select("*")
      .eq("id", dbUser.id)
      .single();
    if (data) setDbUser(data);
  };

  useEffect(() => {
    upsertUser();
  }, [user]);

  return (
    <UserContext.Provider value={{ dbUser, loading, verified, refreshUser }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}

export type { DbUser };
