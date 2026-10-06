import { createListenerMiddleware } from "@reduxjs/toolkit";
import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "./apiSlice";
import type { GetTransactionsArgs, TransactionsEnvelope } from "./apiSlice";
import { monthTagId, defaultTransactionArgs } from "./apiSlice";
import { USER_DATA_STORAGE_KEY } from "@/constants/storageKeys";
import { sessionGeneration, withSessionGeneration } from "@/utils/session";
import { logger } from "@/utils/logger";

/**
 * Offline/cold-start persistence for the RTK Query cache.
 *
 * Replaces the old hand-rolled `utils/cache.ts`. Mirrors only unfiltered
 * page-1 results for the transactions query and all budgets results into
 * AsyncStorage, using versioned keys cleared by the centralized session cleanup.
 *
 * Crucially, the persisted value now contains the backend-authoritative
 * pagination envelope — the root fix for the cached-pagination bug where the
 * old cache stored bare item arrays and fabricated `{totalPages: 1,
 * hasNextPage: false}` on read.
 */

const PREFIX = "rtkq:v2";

const txKey = (userId: string, year: number, month: number) =>
  `${PREFIX}:transactions:${userId}:${year}-${month}`;

const budgetKey = (userId: string, year: number, month: number) =>
  `${PREFIX}:budgets:${userId}:${year}-${month}`;

export const getStoredUserId = async (): Promise<string | null> => {
  try {
    const raw = await AsyncStorage.getItem(USER_DATA_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw)?.id ?? null;
  } catch {
    return null;
  }
};

const isUnfilteredFirstPage = (arg: GetTransactionsArgs | undefined) =>
  !!arg &&
  (arg.page ?? 1) === 1 &&
  !(arg.searchQuery ?? "").trim() &&
  !arg.budgetId &&
  arg.minAmount == null &&
  arg.maxAmount == null &&
  !arg.startDate &&
  !arg.endDate;

/** True when the entry carries real pagination metadata and can be seeded. */
const isSeedableEnvelope = (data: unknown): boolean => {
  if (!data || typeof data !== "object") return false;
  const d = data as { transaction?: unknown; pagination?: unknown };
  return Array.isArray(d.transaction) && !!d.pagination;
};

// NOTE: deliberately left unparameterized — generic params referencing the
// store's own RootState/AppDispatch create a circular type inference that
// degrades `store.dispatch` typing app-wide.
export const apiCachePersistenceMiddleware = createListenerMiddleware();

apiCachePersistenceMiddleware.startListening({
  matcher: api.endpoints.getTransactions.matchFulfilled,
  effect: async (action) => {
    const arg = action.meta.arg.originalArgs as GetTransactionsArgs;
    if (!isUnfilteredFirstPage(arg)) return;
    const generation = sessionGeneration();
    try {
      const userId = await getStoredUserId();
      if (!userId) return;
      // Legacy entries were bare arrays; skip anything without metadata.
      if (!isSeedableEnvelope(action.payload)) return;
      await withSessionGeneration(generation, () => AsyncStorage.setItem(
        txKey(userId, arg.currentYear, arg.currentMonth),
        JSON.stringify({ ts: Date.now(), data: action.payload }),
      ));
    } catch (e) {
      logger.warn("cachePersistence", "Failed to persist transactions", e);
    }
  },
});

apiCachePersistenceMiddleware.startListening({
  matcher: api.endpoints.getBudgets.matchFulfilled,
  effect: async (action) => {
    const arg = action.meta.arg.originalArgs;
    const generation = sessionGeneration();
    try {
      const userId = await getStoredUserId();
      if (!userId) return;
      await withSessionGeneration(generation, () => AsyncStorage.setItem(
        budgetKey(userId, arg.currentYear, arg.currentMonth),
        JSON.stringify({ ts: Date.now(), data: action.payload ?? [] }),
      ));
    } catch (e) {
      logger.warn("cachePersistence", "Failed to persist budgets", e);
    }
  },
});

/**
 * Seed the in-memory cache with last-known data for the current month before
 * the first subscription renders. Entries seeded this way render instantly
 * (offline-friendly cold start) and are revalidated by RTK Query's normal
 * staleness rules.
 */
export const hydrateApiCache = async (store: {
  dispatch: (action: any) => unknown;
}) => {
  const generation = sessionGeneration();
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  try {
    const userId = await getStoredUserId();
    if (!userId) return;

    const [txRaw, budgetRaw] = await Promise.all([
      AsyncStorage.getItem(txKey(userId, year, month)),
      AsyncStorage.getItem(budgetKey(userId, year, month)),
    ]);

    if (generation !== sessionGeneration()) return;

    if (txRaw) {
      const parsed = safeParse(txRaw);
      // Only seed envelopes with authoritative pagination — never fabricate.
      if (isSeedableEnvelope(parsed)) {
        store.dispatch(
          api.util.upsertQueryData(
            "getTransactions",
            defaultTransactionArgs(month, year),
            parsed as TransactionsEnvelope,
          ),
        );
      }
    }

    if (budgetRaw) {
      const parsed = safeParse(budgetRaw);
      if (Array.isArray(parsed)) {
        store.dispatch(
          api.util.upsertQueryData(
            "getBudgets",
            { currentMonth: month, currentYear: year },
            parsed,
          ),
        );
      }
    }

    // Legacy SWR cadence for the seeded month: the seeds above render the
    // first screen instantly, and invalidating their tags makes the first
    // subscription refetch authoritative data in the background (instead of
    // silently serving yesterday's numbers all session). No-ops for any
    // resource that wasn't actually seeded.
    const monthId = monthTagId({ year, month });
    store.dispatch(
      api.util.invalidateTags([
        { type: "Transactions", id: monthId },
        { type: "Budgets", id: monthId },
        { type: "Summary", id: monthId },
      ]),
    );
  } catch (e) {
    logger.warn("cachePersistence", "Failed to hydrate api cache", e);
  }
};

const safeParse = (raw: string): any => {
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && "data" in parsed
      ? parsed.data
      : parsed;
  } catch {
    return null;
  }
};
