import WebApp from "@twa-dev/sdk";

export interface TelegramUser {
  id: number;
  firstName: string;
  lastName?: string;
  username?: string;
  photoUrl?: string;
  languageCode?: string;
}

/**
 * Initialize the Telegram WebApp SDK.
 * Call once before React renders.
 */
export function initTelegram() {
  try {
    WebApp.ready();
    WebApp.expand(); // fill the entire screen
  } catch {
    console.warn("Telegram WebApp SDK not available — running in browser mode");
  }
}

/**
 * Returns true when the app is running inside Telegram.
 */
export function isTelegramEnv(): boolean {
  try {
    return !!WebApp.initData;
  } catch {
    return false;
  }
}

/**
 * Get the current Telegram user, or null when running outside Telegram.
 */
export function getTelegramUser(): TelegramUser | null {
  try {
    const user = WebApp.initDataUnsafe?.user;
    if (!user) return null;
    return {
      id: user.id,
      firstName: user.first_name,
      lastName: user.last_name,
      username: user.username,
      photoUrl: user.photo_url,
      languageCode: user.language_code,
    };
  } catch {
    return null;
  }
}

/**
 * Raw initData string for backend validation.
 */
export function getInitData(): string {
  try {
    return WebApp.initData;
  } catch {
    return "";
  }
}

// --- Haptic feedback helpers ---

export function hapticImpact(style: "light" | "medium" | "heavy" | "rigid" | "soft" = "light") {
  try {
    WebApp.HapticFeedback.impactOccurred(style);
  } catch {
    // not in Telegram
  }
}

export function hapticNotification(type: "error" | "success" | "warning") {
  try {
    WebApp.HapticFeedback.notificationOccurred(type);
  } catch {
    // not in Telegram
  }
}

export function hapticSelection() {
  try {
    WebApp.HapticFeedback.selectionChanged();
  } catch {
    // not in Telegram
  }
}

// --- Back button ---

export function showBackButton(onClick: () => void) {
  try {
    WebApp.BackButton.show();
    WebApp.BackButton.onClick(onClick);
  } catch {
    // not in Telegram
  }
}

export function hideBackButton() {
  try {
    WebApp.BackButton.hide();
    WebApp.BackButton.offClick(() => {});
  } catch {
    // not in Telegram
  }
}

// --- Theme ---

export function getTelegramTheme() {
  try {
    return WebApp.themeParams;
  } catch {
    return null;
  }
}

export function getColorScheme(): "dark" | "light" {
  try {
    return WebApp.colorScheme;
  } catch {
    return "dark";
  }
}

// --- Main Button ---

export function showMainButton(text: string, onClick: () => void) {
  try {
    WebApp.MainButton.setText(text);
    WebApp.MainButton.onClick(onClick);
    WebApp.MainButton.show();
  } catch {
    // not in Telegram
  }
}

export function hideMainButton() {
  try {
    WebApp.MainButton.hide();
    WebApp.MainButton.offClick(() => {});
  } catch {
    // not in Telegram
  }
}

export function setMainButtonLoading(loading: boolean) {
  try {
    if (loading) {
      WebApp.MainButton.showProgress();
    } else {
      WebApp.MainButton.hideProgress();
    }
  } catch {
    // not in Telegram
  }
}

// --- Deep Linking ---

export function getStartParam(): string | undefined {
  try {
    return WebApp.initDataUnsafe?.start_param;
  } catch {
    return undefined;
  }
}

// --- Cloud Storage ---

export function cloudStorageSet(key: string, value: string): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      WebApp.CloudStorage.setItem(key, value, (error: any) => {
        if (error) reject(error);
        else resolve();
      });
    } catch {
      // Fallback to localStorage
      localStorage.setItem(`tg_cloud_${key}`, value);
      resolve();
    }
  });
}

export function cloudStorageGet(key: string): Promise<string | null> {
  return new Promise((resolve, reject) => {
    try {
      WebApp.CloudStorage.getItem(key, (error: any, value: string) => {
        if (error) reject(error);
        else resolve(value || null);
      });
    } catch {
      // Fallback to localStorage
      resolve(localStorage.getItem(`tg_cloud_${key}`));
    }
  });
}

export default WebApp;
