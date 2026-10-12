// ─── Dismissed Recurring Series ─────────────────────────────────────────────
// Client-persisted list of recurring-payment series keys the user dismissed.
//
// Why client-side persistence is sufficient: detection is stateless (computed
// fresh on every read), so a dismissal only needs to survive across app
// restarts on THIS device — there is no server-side series record to keep in
// sync, and no schema change is warranted for v1. Keys are stable normalized
// merchant names from the backend.

import { readEncryptedCache, writeEncryptedCache } from "@/utils/encryptedStorage";
import { getSessionIdentity, withSessionGeneration } from "@/utils/session";

const STORAGE_KEY = "dismissedRecurringSeries";

export async function loadDismissedSeries(): Promise<string[]> {
  try {
    const identity = await getSessionIdentity();
    if (!identity?.userId) return [];
    const parsed = await readEncryptedCache(identity.userId, STORAGE_KEY);
    return Array.isArray(parsed) ? parsed.filter((k) => typeof k === "string") : [];
  } catch {
    return [];
  }
}

export async function saveDismissedSeries(keys: string[]): Promise<void> {
  try {
    const identity = await getSessionIdentity();
    if (!identity?.userId) return;
    await withSessionGeneration(identity.generation, () => writeEncryptedCache(identity.userId!, STORAGE_KEY, keys));
  } catch {
    // Persistence is best-effort; a failed write costs one re-shown card.
  }
}

export async function dismissSeries(key: string): Promise<string[]> {
  const current = await loadDismissedSeries();
  if (!current.includes(key)) {
    current.push(key);
    await saveDismissedSeries(current);
  }
  return current;
}
