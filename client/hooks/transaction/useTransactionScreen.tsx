import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import {
  useAppSelector,
  useAuth,
  useCalendar,
  useFinancialSummary,
  useTheme,
  useTransactionMutationStatus,
} from "@/hooks/useRedux";
import { useGetBudgetsQuery } from "@/store/api/apiSlice";
import { useRefresh } from "@/hooks/useRefresh";
import { useTransactionDisplayAmounts } from "./useTransactionDisplayAmounts";
import { useTransactionFilters } from "./useTransactionFilters";
import { useTransactionSearch } from "./useTransactionSearch";
import { useTransactionOperations } from "./useTransactionOperation";
import SectionHeader from "@/components/transaction/SectionHeader";
import TransactionRow from "@/components/transaction/TxRow";
import ListFooter from "@/components/transaction/TxFooter";
import type { GroupedSection, TransactionItem } from "@/types/transaction/types";

/**
 * Cohesive orchestration hook for the Transactions tab: Redux selectors,
 * display transforms, search/filter/load-more coordination, the two loading
 * coordination mechanisms (search-clear suppression + filter loader), refresh,
 * modal state, loader message, and the SectionList render callbacks.
 */
export const useTransactionScreen = () => {
  // ── Redux selectors ─────────────────────────────────────────────────────
  const { user } = useAuth();
  const activeCurrency = user?.currency || "USD";
  const { THEME } = useTheme();
  const calendar = useCalendar();
  const financialSummary = useFinancialSummary();

  const budgetsQuery = useGetBudgetsQuery({
    currentMonth: calendar.month,
    currentYear: calendar.year,
  });
  const budgets = budgetsQuery.data ?? [];

  // ── Filters ─────────────────────────────────────────────────────────────
  // Filter UI state; declared before the feed so the feed can subscribe with
  // the selected filter values.
  const [filterCategoryId, setFilterCategoryId] = useState<string>("all");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");

  const selectedBudgetId = filterCategoryId !== "all" ? filterCategoryId : null;
  const selectedMinAmount =
    minAmount.trim() === "" ? null : Number(minAmount) || 0;
  const selectedMaxAmount =
    maxAmount.trim() === "" ? null : Number(maxAmount) || 0;

  // ── Server feed (search + filters + pagination) ─────────────────────────
  const {
    searchQuery,
    setSearchQuery,
    normalizedQuery,
    transactions,
    refreshTransactions,
    handleLoadMore,
    isLoading,
    isLoadingMore,
    hasNextPage,
  } = useTransactionSearch({
    currentMonth: calendar.month,
    currentYear: calendar.year,
    budgetId: selectedBudgetId,
    minAmount: selectedMinAmount,
    maxAmount: selectedMaxAmount,
  });
  const isSearching = searchQuery.trim().length > 0;

  const monthlyIncome = Number(financialSummary?.monthlyIncome || 0);
  const actualIncome = Number(financialSummary?.actualIncome || 0);
  const expectedIncome = Number(financialSummary?.expectedIncome || 0);

  const { displayTransactions } = useTransactionDisplayAmounts(
    transactions,
    activeCurrency,
  );

  const {
    sectionsWithTotals,
  } = useTransactionFilters(displayTransactions, budgets, {
    filterCategoryId,
    minAmount,
    maxAmount,
  });

  /** Clears the category/amount filter inputs. */
  const clearFilters = useCallback(() => {
    setFilterCategoryId("all");
    setMinAmount("");
    setMaxAmount("");
  }, []);

  // ── Search-clear skeleton suppression ───────────────────────────────────
  const [suppressInitialSkeleton, setSuppressInitialSkeleton] = useState(false);
  const clearSearchWaitingForLoadRef = useRef(false);
  const clearSearchSawLoadingRef = useRef(false);

  // ── Filtering loader coordination ───────────────────────────────────────
  const [isFiltering, setIsFiltering] = useState(false);
  const filterWaitingForLoadRef = useRef(false);
  const filterSawLoadingRef = useRef(false);
  const previousFiltersRef = useRef({
    query: "",
    budgetId: selectedBudgetId,
    minAmount: selectedMinAmount,
    maxAmount: selectedMaxAmount,
  });

  /** Forwards query changes; arms the skeleton-suppression refs when clearing. */
  const handleSearchQueryChange = useCallback(
    (nextQuery: string) => {
      const hadQuery = searchQuery.trim().length > 0;
      const clearingQuery = hadQuery && nextQuery.trim().length === 0;
      if (clearingQuery) {
        setSuppressInitialSkeleton(true);
        clearSearchWaitingForLoadRef.current = true;
        clearSearchSawLoadingRef.current = false;
      }
      setSearchQuery(nextQuery);
    },
    [searchQuery, setSearchQuery],
  );

  useEffect(() => {
    // Keep suppression active until the clear-search fetch has both started
    // and completed, avoiding a skeleton flash during debounce.
    if (!clearSearchWaitingForLoadRef.current) return;

    if (isLoading) {
      clearSearchSawLoadingRef.current = true;
      return;
    }

    if (clearSearchSawLoadingRef.current) {
      clearSearchWaitingForLoadRef.current = false;
      clearSearchSawLoadingRef.current = false;
      setSuppressInitialSkeleton(false);
    }
  }, [isLoading]);

  // Track filter changes and show loader while filtering is in progress
  useEffect(() => {
    const filtersChanged =
      normalizedQuery !== previousFiltersRef.current.query ||
      selectedBudgetId !== previousFiltersRef.current.budgetId ||
      selectedMinAmount !== previousFiltersRef.current.minAmount ||
      selectedMaxAmount !== previousFiltersRef.current.maxAmount;

    if (filtersChanged) {
      setIsFiltering(true);
      filterWaitingForLoadRef.current = true;
      filterSawLoadingRef.current = isLoading;
    }

    previousFiltersRef.current = {
      query: normalizedQuery,
      budgetId: selectedBudgetId,
      minAmount: selectedMinAmount,
      maxAmount: selectedMaxAmount,
    };
  }, [
    normalizedQuery,
    selectedBudgetId,
    selectedMinAmount,
    selectedMaxAmount,
    isLoading,
  ]);

  // Keep filtering loader visible until fetch starts and the filtered
  // response has been applied to the UI.
  useEffect(() => {
    if (!filterWaitingForLoadRef.current) return;

    if (isLoading) {
      filterSawLoadingRef.current = true;
      return;
    }

    if (!filterSawLoadingRef.current) return;

    const frame = requestAnimationFrame(() => {
      filterWaitingForLoadRef.current = false;
      filterSawLoadingRef.current = false;
      setIsFiltering(false);
    });

    return () => cancelAnimationFrame(frame);
  }, [isLoading, sectionsWithTotals]);


  // ── Pull-to-refresh: transactions (respecting the query) + budgets ─────
  const { refreshing, onRefresh } = useRefresh(() =>
    Promise.all([refreshTransactions(), budgetsQuery.refetch()]),
  );

  // Only the delete handler is needed at screen level;
  // create + update are fully managed inside TransactionModal.
  const { handleDeleteTransaction } = useTransactionOperations();

  // ── Create / edit modal state ──────────────────────────────────────────
  const [openSheet, setOpenSheet] = useState(false);
  const [editingTransaction, setEditingTransaction] =
    useState<TransactionItem | null>(null);

  /** Open the modal in edit mode for the given transaction. */
  const handleEditPress = useCallback((tx: TransactionItem) => {
    setEditingTransaction(tx);
    setOpenSheet(true);
  }, []);

  /** Clear editing state when the modal closes. */
  const handleModalClose = useCallback(() => {
    setEditingTransaction(null);
  }, []);

  // ── Loader message / visibility ─────────────────────────────────────────
  const { isAdding, isEditing, isDeleting } = useTransactionMutationStatus();
  const loaderMessage = isAdding
    ? "Adding transaction…"
    : isEditing
      ? "Updating transaction…"
      : isDeleting
        ? "Deleting transaction…"
        : isFiltering
          ? "Filtering transactions…"
          : "";
  const isLoaderVisible = isAdding || isEditing || isDeleting || isFiltering;

  // ── SectionList render callbacks ───────────────────────────────────────
  const renderSectionHeader = useCallback(
    ({ section }: { section: GroupedSection }) => (
      <SectionHeader
        title={section.title}
        total={section.total}
        currencyCode={activeCurrency}
      />
    ),
    [activeCurrency],
  );

  const renderItem = useCallback(
    ({ item }: { item: TransactionItem }) => (
      <TransactionRow
        tx={item}
        onEdit={handleEditPress}
        onDelete={handleDeleteTransaction}
      />
    ),
    [handleEditPress, handleDeleteTransaction],
  );

  const keyExtractor = useCallback(
    (item: TransactionItem, index: number) => item.id ?? String(index),
    [],
  );

  const listFooter = (
    <ListFooter
      hasNextPage={hasNextPage}
      isLoadingMore={isSearching ? false : isLoadingMore}
      hasTransactions={transactions.length > 0}
      onLoadMore={handleLoadMore}
    />
  );

  /** True only for the genuine first load (no data yet, not searching). */
  const isInitialLoading =
    isLoading &&
    transactions.length === 0 &&
    !isSearching &&
    !suppressInitialSkeleton;

  const listEmpty = (
    <View className="py-12 items-center">
      {isInitialLoading ? (
        <ActivityIndicator size="large" color={THEME.primary} />
      ) : (
        <Text style={{ color: THEME.textSecondary }}>
          No transactions match filters.
        </Text>
      )}
    </View>
  );

  return {
    displayTransactions,
    budgets,
    monthlyIncome,
    actualIncome,
    expectedIncome,
    activeCurrency,
    month: calendar.month,
    year: calendar.year,
    searchQuery,
    handleSearchQueryChange,
    isSearching,
    filterCategoryId,
    setFilterCategoryId,
    minAmount,
    setMinAmount,
    maxAmount,
    setMaxAmount,
    clearFilters,
    sectionsWithTotals,
    isFiltering,
    keyExtractor,
    renderSectionHeader,
    renderItem,
    listFooter,
    listEmpty,
    refreshing,
    onRefresh,
    openSheet,
    setOpenSheet,
    editingTransaction,
    handleModalClose,
    isLoaderVisible,
    loaderMessage,
  };
};

