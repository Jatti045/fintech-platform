import { useCallback, useEffect, useMemo, useState } from "react";
import { useAppDispatch, useCalendar, useUser } from "@/hooks/useRedux";
import { nextMonth, prevMonth } from "@/store/slices/calendarSlice";
import {
  defaultTransactionArgs,
  useGetBudgetsQuery,
  useGetRecurringPaymentsQuery,
  useGetTransactionsQuery,
} from "@/store/api/apiSlice";
import { useFinancialReport } from "@/hooks/reporting/useFinancialReport";
import { useRefresh } from "@/hooks/useRefresh";
import { useTransactionDisplayAmounts } from "@/hooks/transaction/useTransactionDisplayAmounts";
import { useBudgetDisplayAmounts } from "@/hooks/budget/useBudgetDisplayAmounts";
import { PAGINATION_LIMIT } from "@/constants/appConfig";
import type { IBudget } from "@/types/budget/types";
import type { ITransaction } from "@/types/transaction/types";
import type { IRecurringPayment } from "@/types/recurring/types";
import {
  loadDismissedSeries,
  dismissSeries,
} from "@/utils/recurring/dismissedSeries";

/**
 * Stable empty-array fallbacks.
 *
 * The display-amount hooks run `setState` from effects keyed on these inputs,
 * so the fallbacks MUST be referentially stable — an inline `?? []` creates a
 * new array every render and, while RTK Query data is pending, produces an
 * infinite effect/render loop (the old slices had stable initial states).
 */
const NO_TRANSACTIONS: ITransaction[] = [];
const NO_BUDGETS: IBudget[] = [];

/**
 * Cohesive orchestration hook for the Home tab.
 *
 * Owns everything the screen needs that is neither global Redux state nor
 * pure presentation:
 *
 *  - month-scoped RTK Query subscriptions (transactions, budgets, summary).
 *    Subscribing is the only fetch mechanism — requests are deduped across
 *    all screens viewing the same month, and cache entries are keyed per
 *    month so navigation can never mix months.
 *  - backend-normalized financial aggregates
 *  - month metadata + calendar navigation handlers
 *  - help modal state
 *
 * Contains no JSX. Global data stays in Redux; display transforms stay in
 * `useTransactionDisplayAmounts` / `useBudgetDisplayAmounts`.
 */
export const useHomeScreen = () => {
  const dispatch = useAppDispatch();
  const user = useUser();
  const activeCurrency = user?.currency || "USD";
  const calendar = useCalendar();

  const transactionsQuery = useGetTransactionsQuery({
    ...defaultTransactionArgs(calendar.month, calendar.year),
    limit: PAGINATION_LIMIT,
  });
  const budgetsQuery = useGetBudgetsQuery({
    currentMonth: calendar.month,
    currentYear: calendar.year,
  });
  const financialSummaryQuery = useFinancialReport(
    calendar.month,
    calendar.year,
  );

  const transactions =
    transactionsQuery.currentData?.transaction ?? NO_TRANSACTIONS;
  const budgets = budgetsQuery.currentData ?? NO_BUDGETS;
  const financialSummary = financialSummaryQuery.report?.summary ?? null;

  // ── Upcoming Bills ─────────────────────────────────────────────────────
  // Predictions are day-scoped (`today` busts the cache at midnight) and
  // filtered client-side by persisted dismissals. Failures degrade silently —
  // Home's other content must never be blocked by an analytics nicety.
  const todayKey = useMemo(
    () =>
      `${new Date().getFullYear()}-${new Date().getMonth() + 1}-${new Date().getDate()}`,
    // Recomputed per render is fine; memo keeps the arg reference stable.
    [],
  );
  const recurringQuery = useGetRecurringPaymentsQuery({ today: todayKey });

  const [dismissedKeys, setDismissedKeys] = useState<string[]>([]);
  useEffect(() => {
    let cancelled = false;
    loadDismissedSeries().then((keys) => {
      if (!cancelled) setDismissedKeys(keys);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  /** Dismisses a series locally (persisted) so it stops appearing. */
  const handleDismissBill = useCallback((seriesKey: string) => {
    setDismissedKeys((prev) =>
      prev.includes(seriesKey) ? prev : [...prev, seriesKey],
    );
    void dismissSeries(seriesKey);
  }, []);

  const upcomingBills: IRecurringPayment[] = useMemo(() => {
    const all = recurringQuery.data?.recurringPayments ?? [];
    return all.filter((b) => !dismissedKeys.includes(b.seriesKey)).slice(0, 5);
  }, [recurringQuery.data, dismissedKeys]);

  const { displayTransactions } = useTransactionDisplayAmounts(
    transactions,
    activeCurrency,
  );
  const { displayBudgets } = useBudgetDisplayAmounts(
    budgets,
    transactions,
    activeCurrency,
  );

  // ── Modal / screen-level UI state ─────────────────────────────────────
  const [helpOpen, setHelpOpen] = useState(false);

  // ── Pull-to-refresh: force a network revalidation of all three sources ─
  const { refreshing, onRefresh } = useRefresh(() =>
    Promise.all([
      transactionsQuery.refetch(),
      budgetsQuery.refetch(),
      financialSummaryQuery.refetch(),
      recurringQuery.refetch(),
    ]),
  );

  // ── Month metadata (trivial — computed directly, no memo) ─────────────
  const now = new Date();
  const isCurrentMonth =
    calendar.month === now.getUTCMonth() &&
    calendar.year === now.getUTCFullYear();
  const monthLabel = `${new Date(calendar.year, calendar.month, 1).toLocaleString(undefined, { month: "long" })} ${calendar.year}`;

  // ── Calendar navigation ───────────────────────────────────────────────
  const handlePrevMonth = useCallback(() => {
    dispatch(prevMonth());
  }, [dispatch]);

  const handleNextMonth = useCallback(() => {
    dispatch(nextMonth());
  }, [dispatch]);

  const handleInfoPress = useCallback(() => {
    setHelpOpen(true);
  }, []);

  return {
    reporting: financialSummaryQuery,
    transactionsLoading:
      transactionsQuery.isFetching && !transactionsQuery.currentData,
    transactionsError: Boolean(transactionsQuery.error),
    retryTransactions: () => {
      void transactionsQuery.refetch();
    },
    billsLoading: recurringQuery.isFetching && !recurringQuery.currentData,
    billsError: Boolean(recurringQuery.error),
    retryBills: () => {
      void recurringQuery.refetch();
    },
    transactions,
    displayTransactions,
    displayBudgets,
    activeCurrency,
    monthlyIncome: Number(financialSummary?.monthlyIncome || 0),
    // The API guarantees that all summary fields are already denominated in
    // the user's selected currency; never convert an aggregate client-side.
    expenseTotal: Number(financialSummary?.totalAmount || 0),
    monthLabel,
    isCurrentMonth,
    month: calendar.month,
    year: calendar.year,
    upcomingBills,
    handleDismissBill,
    helpOpen,
    setHelpOpen,
    refreshing,
    onRefresh,
    handlePrevMonth,
    handleNextMonth,
    handleInfoPress,
  };
};
