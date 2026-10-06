import AsyncStorage from "@react-native-async-storage/async-storage";
import { AUTH_TOKEN_STORAGE_KEY, USER_DATA_STORAGE_KEY } from "@/constants/storageKeys";
import { getAuthToken, setAuthToken, clearAuthToken } from "./secureStorage";
import { logger } from "./logger";

export interface SessionIdentity { token: string; generation: number }
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
    return token ? { token, generation } : null;
  });
}

export function establishSession(token: string, user: unknown): Promise<void> {
  return serialize(async () => {
    generation++;
    await setAuthToken(token);
    await AsyncStorage.setItem(USER_DATA_STORAGE_KEY, JSON.stringify(user));
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
      logger.warn("session", "Failed to clear persisted session data", result.reason);
    }
    return true;
  });
}

// Persisted cache writes share the cleanup queue; an in-flight write cannot
// resurrect financial data after logout or expiration.
export function withSessionGeneration<T>(expected: number, operation: () => Promise<T>): Promise<T | undefined> {
  return serialize(async () => expected === generation ? operation() : undefined);
}
