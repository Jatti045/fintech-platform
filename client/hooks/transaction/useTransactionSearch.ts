import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  defaultTransactionArgs,
  useGetTransactionsQuery,
} from "@/store/api/apiSlice";
import { useAppSelector } from "../useRedux";
import { PAGINATION_LIMIT } from "@/constants/appConfig";

const NO_TRANSACTIONS: never[] = [];

type UseTransactionSearchParams = {
  currentMonth: number;
  currentYear: number;
  budgetId?: string | null;
  minAmount?: number | null;
  maxAmount?: number | null;
};

/**
 * Owns the Transactions tab's server feed.
 *
 * Replaces the old thunk-based search/load-more machinery:
 *
 * - Subscribes to the single `getTransactions` cache entry for
 *   `{month, year, search, filters}` — page is excluded from the cache key
 *   and accumulated via `merge`, so load-more appends into one entry.
 * - Debounces user input (~350ms) before it reaches the query args.
 * - Resets to page 1 whenever the month or any filter changes.
 * - Exposes authoritative pagination (`hasNextPage`) straight from the
 *   backend envelope — cached months can never report a false
 *   `totalPages: 1`.
 */
export function useTransactionSearch({
  currentMonth,
  currentYear,
  budgetId,
  minAmount,
  maxAmount,
}: UseTransactionSearchParams) {
  const [searchQuery, setSearchQuery] = useState("");
  const normalizedQuery = useMemo(() => searchQuery.trim(), [searchQuery]);
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [page, setPage] = useState(1);
  const didInitRef = useRef(false);

  // Debounce the query before it becomes part of the request/cache key.
  useEffect(() => {
    if (!didInitRef.current) {
      didInitRef.current = true;
      if (!normalizedQuery) {
        setDebouncedQuery("");
        return;
      }
    }

    const timer = setTimeout(() => {
      setDebouncedQuery(normalizedQuery);
    }, 350);

    return () => clearTimeout(timer);
  }, [normalizedQuery]);

  // A new month or filter set invalidates accumulated pages.
  const scopeKey = useMemo(
    () =>
      JSON.stringify([
        currentMonth,
        currentYear,
        debouncedQuery,
        budgetId,
        minAmount,
        maxAmount,
      ]),
    [currentMonth, currentYear, debouncedQuery, budgetId, minAmount, maxAmount],
  );

  useEffect(() => {
    setPage(1);
  }, [scopeKey]);

  /**
   * When transaction mutations (create/update/delete — including ones
   * initiated by the shared TxModal instance) SETTLE, collapse back to page 1.
   *
   * Transaction mutations deliberately do not invalidate the Transactions tag
   * (see apiSlice): an invalidation-driven refetch reuses the entry's ORIGINAL
   * args, which after load-more is a higher page whose merge-append can
   * resurrect rows the server already deleted ("ghosts"). Instead, this hook
   * watches the RTK Query mutation entries directly — counting settled
   * mutation entries (not pending/idle transitions, which can be missed when
   * a dispatch and its resolution land inside one render batch) — and resets
   * to page 1. The args change forces a network fetch whose merge REPLACES
   * the accumulated list with authoritative page-1 data, matching the legacy
   * explicit page-1 re-fetch after every successful mutation.
   */
  const settledMutationCount = useAppSelector((state) => {
    const mutations = (state.api?.mutations ?? {}) as Record<string, any>;
    let count = 0;
    for (const key of Object.keys(mutations)) {
      const entry = mutations[key];
      if (
        (entry?.endpointName === "createTransaction" ||
          entry?.endpointName === "updateTransaction" ||
          entry?.endpointName === "deleteTransaction") &&
        entry.status !== "pending"
      ) {
        count += 1;
      }
    }
    return count;
  });

  const query = useGetTransactionsQuery({
    ...defaultTransactionArgs(currentMonth, currentYear),
    searchQuery: debouncedQuery,
    budgetId,
    minAmount,
    maxAmount,
    page,
    limit: PAGINATION_LIMIT,
  });

  const prevSettledRef = useRef(0);
  useEffect(() => {
    if (settledMutationCount > prevSettledRef.current) {
      if (page === 1) {
        query.refetch();
      } else {
        setPage(1);
      }
    }
    prevSettledRef.current = settledMutationCount;
  }, [settledMutationCount, page, query]);

  const pagination = query.data?.pagination;

  /** Pull-to-refresh: re-fetch page 1 for the active query, replacing the list. */
  const refreshTransactions = useCallback(() => {
    if (page === 1) return query.refetch();
    setPage(1);
    return Promise.resolve();
  }, [query, page]);

  /** Infinite scroll: advance to the next authoritative page. */
  const handleLoadMore = useCallback(() => {
    if (query.isFetching || !pagination?.hasNextPage) return;
    setPage((p) => p + 1);
  }, [query.isFetching, pagination?.hasNextPage]);

  const isLoadingMore = query.isFetching && page > 1;
  const error =
    query.error && typeof query.error === "object" && "error" in query.error
      ? String((query.error as any).error)
      : null;

  return {
    searchQuery,
    setSearchQuery,
    normalizedQuery,
    transactions: query.data?.transaction ?? NO_TRANSACTIONS,
    refreshTransactions,
    handleLoadMore,
    isLoading: query.isFetching,
    isLoadingMore,
    hasNextPage: pagination?.hasNextPage ?? false,
    error,
  };
}
