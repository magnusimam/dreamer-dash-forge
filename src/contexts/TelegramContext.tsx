import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  type TelegramUser,
  getTelegramUser,
  isTelegramEnv,
  getInitData,
  getColorScheme,
} from "@/lib/telegram";

interface TelegramContextValue {
  user: TelegramUser | null;
  isTelegram: boolean;
  initData: string;
  colorScheme: "dark" | "light";
}

const TelegramContext = createContext<TelegramContextValue>({
  user: null,
  isTelegram: false,
  initData: "",
  colorScheme: "dark",
});

// Fallback user for browser development (outside Telegram)
const DEV_USER: TelegramUser = {
  id: 0,
  firstName: "Dreamer",
  lastName: "",
  username: "dreamer",
};

export function TelegramProvider({ children }: { children: ReactNode }) {
  const [ctx, setCtx] = useState<TelegramContextValue>({
    user: null,
    isTelegram: false,
    initData: "",
    colorScheme: "dark",
  });

  useEffect(() => {
    const inTelegram = isTelegramEnv();
    const user = inTelegram ? getTelegramUser() : DEV_USER;
    setCtx({
      user,
      isTelegram: inTelegram,
      initData: getInitData(),
      colorScheme: getColorScheme(),
    });
  }, []);

  return (
    <TelegramContext.Provider value={ctx}>{children}</TelegramContext.Provider>
  );
}

export function useTelegram() {
  return useContext(TelegramContext);
}
