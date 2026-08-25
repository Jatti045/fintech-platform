// ─── Dismissed Recurring Series ─────────────────────────────────────────────
// Client-persisted list of recurring-payment series keys the user dismissed.
//
// Why client-side persistence is sufficient: detection is stateless (computed
// fresh on every read), so a dismissal only needs to survive across app
// restarts on THIS device — there is no server-side series record to keep in
// sync, and no schema change is warranted for v1. Keys are stable normalized
// merchant names from the backend.

import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "dismissedRecurringSeries";

export async function loadDismissedSeries(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((k) => typeof k === "string") : [];
  } catch {
    return [];
  }
}

export async function saveDismissedSeries(keys: string[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
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
