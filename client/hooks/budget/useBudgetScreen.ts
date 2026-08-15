import { useCallback, useMemo, useState } from "react";
import {
  useAppDispatch,
  useBudgets,
  useBudgetStatus,
  useCalendar,
  useTransactions,
  useUser,
} from "@/hooks/useRedux";
import { fetchBudgets } from "@/store/slices/budgetSlice";
import { useRefresh } from "@/hooks/useRefresh";
import { useBudgetDisplayAmounts } from "./useBudgetDisplayAmounts";
import { useBudgetOperations } from "./useBudgetOperation";
import type { DisplayBudget, IBudget } from "@/types/budget/types";

/**
 * Cohesive screen hook for the Budget tab.
 *
 * Owns everything the screen needs that is neither global Redux state nor
 * pure presentation:
 *
 *  - Redux selectors (budgets, transactions, user currency, calendar, status)
 *  - the display-budget transformation (`useBudgetDisplayAmounts`)
 *  - screen state: search query, selected budget, create/edit modal state
 *  - derived data: filtered/budgeted/unbudgeted collections, selected budget,
 *    month label, initial-loading flag
 *  - screen event handlers + pull-to-refresh
 *
 * Global auth/budget data stays in Redux; the hook only derives screen-level
 * views of it. Contains no JSX.
 */
export const useBudgetScreen = () => {
  // ── Redux selectors ─────────────────────────────────────────────────────
  const budgets = useBudgets();
  const transactions = useTransactions();
  const user = useUser();
  const activeCurrency = user?.currency || "USD";
  const { isLoading } = useBudgetStatus();
  const calendar = useCalendar();
  const dispatch = useAppDispatch();

  const { displayBudgets } = useBudgetDisplayAmounts(
    budgets,
    transactions,
    activeCurrency,
  );

  // Only the delete handler is needed at screen level;
  // create + update are fully managed inside BudgetModal.
  const { handleDeleteBudget } = useBudgetOperations();

  // ── Screen-level state ────────────────────────────────────────────────
  const [openSheet, setOpenSheet] = useState(false);
  const [editingBudget, setEditingBudget] = useState<IBudget | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  /** Budget whose drawer is expanded AND feeds the oscilloscope. */
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const isSearching = searchQuery.trim().length > 0;
  const isInitialLoading = isLoading && budgets.length === 0 && !isSearching;

  const { refreshing, onRefresh } = useRefresh(() =>
    dispatch(
      fetchBudgets({
        currentMonth: calendar.month,
        currentYear: calendar.year,
      }),
    ),
  );

  // ── Derived data ──────────────────────────────────────────────────────

  const filteredBudgets = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return displayBudgets;
    return displayBudgets.filter((b) =>
      (b.category ?? "").toLowerCase().includes(q),
    );
  }, [displayBudgets, searchQuery]);

  // Auto-created Plaid categories with $0 limits are flagged "unbudgeted"
  // until the user assigns a limit. Group them under their own section.
  const { unbudgetedBudgets, budgetedBudgets } = useMemo(() => {
    const isUnbudgeted = (b: DisplayBudget) =>
      b.autoCreated === true || (b.displayLimit <= 0 && b.displaySpent > 0);
    return {
      unbudgetedBudgets: filteredBudgets.filter(isUnbudgeted),
      budgetedBudgets: filteredBudgets.filter((b) => !isUnbudgeted(b)),
    };
  }, [filteredBudgets]);

  // The selected budget follows `selectedId`; when that budget is no longer
  // visible (e.g. filtered out by search) it falls back to the first visible
  // one. This single derived value drives both the trend card and the row's
  // expanded state, so no effect is needed to keep the selection in sync.
  const selectedBudget = useMemo(
    () =>
      filteredBudgets.find((b) => b.id === selectedId) ?? filteredBudgets[0],
    [filteredBudgets, selectedId],
  );

  const monthLabel = useMemo(
    () =>
      new Date(calendar.year, calendar.month, 1).toLocaleString(undefined, {
        month: "long",
      }),
    [calendar.year, calendar.month],
  );

  const hasBudgets = budgets.length > 0;

  // ── Stable callbacks ──────────────────────────────────────────────────

  const handleToggle = useCallback((budget: IBudget) => {
    setSelectedId(budget.id);
  }, []);

  const handleEditPress = useCallback((budget: IBudget) => {
    setEditingBudget(budget);
    setOpenSheet(true);
  }, []);

  const handleModalClose = useCallback(() => {
    setOpenSheet(false);
    setEditingBudget(null);
  }, []);

  const handleNewBudget = useCallback(() => {
    setOpenSheet(true);
  }, []);

  return {
    searchQuery,
    setSearchQuery,
    isSearching,
    filteredBudgets,
    budgetedBudgets,
    unbudgetedBudgets,
    selectedBudget,
    hasBudgets,
    isInitialLoading,
    refreshing,
    monthLabel,
    activeCurrency,
    openSheet,
    setOpenSheet,
    editingBudget,
    transactions,
    month: calendar.month,
    year: calendar.year,
    handleToggle,
    handleEditPress,
    handleNewBudget,
    handleModalClose,
    handleDeleteBudget,
    onRefresh,
  };
};
