import AsyncStorage from "@react-native-async-storage/async-storage";
import { AUTH_TOKEN_STORAGE_KEY, USER_DATA_STORAGE_KEY } from "@/constants/storageKeys";
import { getAuthToken, setAuthToken, clearAuthToken } from "./secureStorage";
import { logger } from "./logger";
import * as SecureStore from "expo-secure-store";
import { clearEncryptedCache, migrateLegacyFinancialCache, writeEncryptedCache } from "./encryptedStorage";

export const SESSION_USER_ID_KEY = "sessionUserIdV1";

export interface SessionIdentity { token: string; generation: number; userId?: string | null }
let generation = 0;
let queue: Promise<unknown> = Promise.resolve();
let resetState = () => {};

// Avoid importing the store into the HTTP layer (and creating an import cycle).
export function registerSessionReset(reset: () => void) { resetState = reset; }

function serialize<T>(operation: () => Promise<T>): Promise<T> {
  const result = queue.then(operation);
  queue = result.catch(() => {});
  return result;
}

export function sessionGeneration() { return generation; }

export function getSessionIdentity(): Promise<SessionIdentity | null> {
  return serialize(async () => {
    const token = await getAuthToken();
    const userId = token ? await SecureStore.getItemAsync(SESSION_USER_ID_KEY) : null;
    return token ? { token, generation, userId } : null;
  });
}

export function establishSession(token: string, user: unknown): Promise<void> {
  return serialize(async () => {
    const userId = (user as { id?: string })?.id;
    if (!userId) throw new Error("Authenticated user identity missing");
    generation++;
    resetState();
    await SecureStore.deleteItemAsync(SESSION_USER_ID_KEY);
    try { await clearEncryptedCache(); await migrateLegacyFinancialCache(); }
    catch { logger.warn("session", "Cache cleanup will retry; cached data is unavailable"); }
    await setAuthToken(token);
    await SecureStore.setItemAsync(SESSION_USER_ID_KEY, userId, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    try { await writeEncryptedCache(userId, "profile", user); }
    catch { logger.warn("session", "Profile cache unavailable; server data will be used"); }
  });
}

export function persistSessionUser(user: { id: string }, expected: number): Promise<void> {
  return serialize(async () => {
    if (expected !== generation || !await getAuthToken()) return;
    if (await SecureStore.getItemAsync(SESSION_USER_ID_KEY) !== user.id) return;
    try { await writeEncryptedCache(user.id, "profile", user); }
    catch { logger.warn("session", "Profile cache unavailable"); }
  });
}

export function restoreSessionUser(identity: SessionIdentity, user: { id: string }): Promise<boolean> {
  return serialize(async () => {
    if (identity.generation !== generation || identity.token !== await getAuthToken()) return false;
    if (identity.userId && identity.userId !== user.id) return false;
    await SecureStore.setItemAsync(SESSION_USER_ID_KEY, user.id, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    try { await writeEncryptedCache(user.id, "profile", user); }
    catch { logger.warn("session", "Profile cache unavailable"); }
    return true;
  });
}

/** Only the session that issued a request may be invalidated by its response. */
export function invalidateSession(expected?: SessionIdentity | null): Promise<boolean> {
  return serialize(async () => {
    if (expected !== undefined && (!expected || expected.generation !== generation
      || expected.token !== await getAuthToken())) return false;
    generation++;
    resetState();
    // Login persistence shares this queue: cleanup can never delete a newer login.
    const results = await Promise.allSettled([
      clearAuthToken(),
      clearEncryptedCache(),
      SecureStore.deleteItemAsync(SESSION_USER_ID_KEY),
      (async () => {
        const keys = await AsyncStorage.getAllKeys();
        await AsyncStorage.multiRemove(keys.filter(key =>
          key === AUTH_TOKEN_STORAGE_KEY || key === USER_DATA_STORAGE_KEY
          || key === "dismissedRecurringSeries"
          || key === "notificationPreferences" || key === "notificationOnboardingPending"
          || key.startsWith("rtkq:") || key.startsWith("transactions:") || key.startsWith("budgets:"),
        ));
      })(),
    ]);
    for (const result of results) if (result.status === "rejected") {
      logger.warn("session", "Failed to clear persisted session data");
    }
    return true;
  });
}

// Persisted cache writes share the cleanup queue; an in-flight write cannot
// resurrect financial data after logout or expiration.
export function withSessionGeneration<T>(expected: number, operation: () => Promise<T>): Promise<T | undefined> {
  return serialize(async () => expected === generation ? operation() : undefined);
}
