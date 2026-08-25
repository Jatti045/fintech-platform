import { useCallback, useEffect, useState } from "react";
import {
  useAppDispatch,
  useCalendar,
  useUser,
} from "@/hooks/useRedux";
import { nextMonth, prevMonth } from "@/store/slices/calendarSlice";
import {
  defaultTransactionArgs,
  useGetBudgetsQuery,
  useGetFinancialSummaryQuery,
  useGetTransactionsQuery,
} from "@/store/api/apiSlice";
import { useRefresh } from "@/hooks/useRefresh";
import { useTransactionDisplayAmounts } from "@/hooks/transaction/useTransactionDisplayAmounts";
import { useBudgetDisplayAmounts } from "@/hooks/budget/useBudgetDisplayAmounts";
import { useThemedAlert } from "@/utils/themedAlert";
import { convertCurrency } from "@/utils/currencyConverter";
import {
  inferExpenseSourceCurrency,
  normalizeCurrency,
} from "@/utils/currencyInference";
import { PAGINATION_LIMIT } from "@/constants/appConfig";
import type { IBudget } from "@/types/budget/types";
import type { ITransaction } from "@/types/transaction/types";

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
 *  - currency conversion of the expense total (with stale-response guard)
 *  - month metadata + calendar navigation handlers
 *  - modal state + the "budget required" transaction guard
 *
 * Contains no JSX. Global data stays in Redux; display transforms stay in
 * `useTransactionDisplayAmounts` / `useBudgetDisplayAmounts`.
 */
export const useHomeScreen = () => {
  const { showAlert } = useThemedAlert();
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
  const financialSummaryQuery = useGetFinancialSummaryQuery({
    currentMonth: calendar.month,
    currentYear: calendar.year,
  });

  const transactions = transactionsQuery.data?.transaction ?? NO_TRANSACTIONS;
  const budgets = budgetsQuery.data ?? NO_BUDGETS;
  const financialSummary = financialSummaryQuery.data ?? null;

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
  const [openTxModal, setOpenTxModal] = useState(false);
  const [openBudgetModal, setOpenBudgetModal] = useState(false);

  // ── Pull-to-refresh: force a network revalidation of all three sources ─
  const { refreshing, onRefresh } = useRefresh(() =>
    Promise.all([
      transactionsQuery.refetch(),
      budgetsQuery.refetch(),
      financialSummaryQuery.refetch(),
    ]),
  );

  // ── Currency conversion of the expense total ─────────────────────────
  // The financial summary total may be denominated in a legacy source
  // currency; infer it from the expense transactions and convert for display.
  // A `cancelled` flag keeps a stale conversion (e.g. after a month change)
  // from overwriting the latest result. Conversion failures fall back to the
  // raw total.
  const [convertedExpenseTotal, setConvertedExpenseTotal] = useState(
    Number(financialSummary?.totalAmount || 0),
  );

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const rawTotal = Number(financialSummary?.totalAmount || 0);
      const toCurrency = normalizeCurrency(activeCurrency) || "USD";
      const fromCurrency = inferExpenseSourceCurrency(
        transactions,
        user?.currency,
      );

      if (!rawTotal || fromCurrency === toCurrency) {
        if (!cancelled) setConvertedExpenseTotal(rawTotal);
        return;
      }

      try {
        const converted = await convertCurrency(
          rawTotal,
          fromCurrency,
          toCurrency,
        );
        if (!cancelled) setConvertedExpenseTotal(Number(converted || 0));
      } catch {
        if (!cancelled) setConvertedExpenseTotal(rawTotal);
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [financialSummary?.totalAmount, activeCurrency, transactions, user?.currency]);

  // ── Month metadata (trivial — computed directly, no memo) ─────────────
  const now = new Date();
  const isCurrentMonth =
    calendar.month === now.getMonth() && calendar.year === now.getFullYear();
  const monthLabel = `${new Date(calendar.year, calendar.month, 1).toLocaleString(undefined, { month: "long" })} ${calendar.year}`;

  // ── Calendar navigation ───────────────────────────────────────────────
  const handlePrevMonth = useCallback(() => {
    dispatch(prevMonth());
  }, [dispatch]);

  const handleNextMonth = useCallback(() => {
    dispatch(nextMonth());
  }, [dispatch]);

  // ── Quick actions ─────────────────────────────────────────────────────
  const handleNewBudget = useCallback(() => {
    setOpenBudgetModal(true);
  }, []);

  /** Guard: a budget must exist for the month before a transaction can be added. */
  const handleNewTransaction = useCallback(() => {
    if (budgets.length === 0) {
      showAlert({
        title: "No budgets available",
        message: "No budgets exist for this month. Please create a budget first.",
      });
      return;
    }
    setOpenTxModal(true);
  }, [budgets.length, showAlert]);

  const handleInfoPress = useCallback(() => {
    setHelpOpen(true);
  }, []);

  return {
    transactions,
    displayTransactions,
    displayBudgets,
    activeCurrency,
    monthlyIncome: Number(financialSummary?.monthlyIncome || 0),
    expenseTotal: convertedExpenseTotal,
    monthLabel,
    isCurrentMonth,
    month: calendar.month,
    year: calendar.year,
    helpOpen,
    openTxModal,
    openBudgetModal,
    setHelpOpen,
    setOpenTxModal,
    setOpenBudgetModal,
    refreshing,
    onRefresh,
    handlePrevMonth,
    handleNextMonth,
    handleNewTransaction,
    handleNewBudget,
    handleInfoPress,
  };
};
