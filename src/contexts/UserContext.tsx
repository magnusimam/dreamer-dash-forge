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
  const { initData } = useTelegram();
  const [dbUser, setDbUser] = useState<DbUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [verified, setVerified] = useState(false);

  const upsertUser = async () => {
    // Identity is established server-side from the signed Telegram initData.
    // The RPC verifies the HMAC and derives telegram_id from the *verified*
    // payload — the client no longer asserts who it is. Outside Telegram,
    // initData is empty and the gateway only resolves a user if the database
    // has a `dev_user_telegram_id` setting (dev/staging only).
    try {
      const { data, error } = await supabase.rpc("upsert_telegram_user", {
        p_init_data: initData,
      });

      if (error) throw error;
      setDbUser(data);
      setVerified(true);
    } catch (err) {
      console.error("Telegram identity verification failed:", err);
      setVerified(false);
      setDbUser(null);
    } finally {
      setLoading(false);
    }
  };

  const refreshUser = async () => {
    if (!dbUser) return;
    // Read own full row (incl. bank, which is column-revoked for direct selects)
    // through the verified gateway.
    const { data } = await supabase.rpc("get_me", { p_init_data: initData });
    if (data) setDbUser(data);
  };

  useEffect(() => {
    upsertUser();
  }, [initData]);

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
