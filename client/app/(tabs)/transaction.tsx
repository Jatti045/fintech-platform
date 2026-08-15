import React, {
  useMemo,
  useState,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { useRefresh } from "@/hooks/useRefresh";
import {
  ActivityIndicator,
  RefreshControl,
  SectionList,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import TransactionModal from "@/components/transaction/TxModal";
import SearchBar from "@/components/global/SearchBar";
import AddNewTransactionButton from "@/components/transaction/AddTxButton";
import FilterTransaction from "@/components/transaction/TxFilterOpt";
import SectionHeader from "@/components/transaction/SectionHeader";
import TransactionRow from "@/components/transaction/TxRow";
import ListFooter from "@/components/transaction/TxFooter";
import FlowHeader from "@/components/transaction/FlowHeader";
import { useTransactionOperations } from "@/hooks/transaction/useTransactionOperation";
import { useTransactionFilters } from "@/hooks/transaction/useTransactionFilters";
import { useTransactionLoadMore } from "@/hooks/transaction/useTransactionLoadMore";
import { useTransactionSearch } from "@/hooks/transaction/useTransactionSearch";
import { useTransactionDisplayAmounts } from "@/hooks/transaction/useTransactionDisplayAmounts";
import type { TransactionItem } from "@/types/transaction/types";
import {
  useAuth,
  useBudgets,
  useTheme,
  useTransactions,
  useTransactionStatus,
  useCalendar,
  useFinancialSummary,
} from "@/hooks/useRedux";
import { useAppDispatch } from "@/store";
import { fetchBudgets } from "@/store/slices/budgetSlice";
import Loader from "@/utils/loader";
import { PAGINATION_LIMIT } from "@/constants/appConfig";

export default function TransactionScreen() {
  const transactions = useTransactions();
  const budgets = useBudgets();
  const { user } = useAuth();
  const activeCurrency = user?.currency || "USD";
  const { THEME } = useTheme();
  const { isAdding, isEditing, isDeleting, isLoading } = useTransactionStatus();
  const calendar = useCalendar();
  const dispatch = useAppDispatch();

  const { displayTransactions } = useTransactionDisplayAmounts(
    transactions,
    activeCurrency,
  );

  const financialSummary = useFinancialSummary();
  const monthlyIncome = Number(financialSummary?.monthlyIncome || 0);

  // Custom hook encapsulating all filter state + logic for deriving the filtered + grouped transaction data fed into the SectionList.
  const {
    filterCategoryId,
    setFilterCategoryId,
    minAmount,
    setMinAmount,
    maxAmount,
    setMaxAmount,
    clearFilters,
    sectionsWithTotals,
  } = useTransactionFilters(displayTransactions, budgets);

  const selectedBudgetId = filterCategoryId !== "all" ? filterCategoryId : null;
  const selectedMinAmount =
    minAmount.trim() === "" ? null : Number(minAmount) || 0;
  const selectedMaxAmount =
    maxAmount.trim() === "" ? null : Number(maxAmount) || 0;

  const { searchQuery, setSearchQuery, normalizedQuery, refreshTransactions } =
    useTransactionSearch({
      currentMonth: calendar.month,
      currentYear: calendar.year,
      limit: PAGINATION_LIMIT,
      budgetId: selectedBudgetId,
      minAmount: selectedMinAmount,
      maxAmount: selectedMaxAmount,
    });
  const isSearching = searchQuery.trim().length > 0;
  const [suppressInitialSkeleton, setSuppressInitialSkeleton] = useState(false);
  const clearSearchWaitingForLoadRef = useRef(false);
  const clearSearchSawLoadingRef = useRef(false);
  const [isFiltering, setIsFiltering] = useState(false);
  const filterWaitingForLoadRef = useRef(false);
  const filterSawLoadingRef = useRef(false);
  const previousFiltersRef = useRef({
    query: "",
    budgetId: selectedBudgetId,
    minAmount: selectedMinAmount,
    maxAmount: selectedMaxAmount,
  });

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

  // Use generic refresh hook
  const { refreshing, onRefresh } = useRefresh(() =>
    Promise.all([
      refreshTransactions(),
      dispatch(
        fetchBudgets({
          currentMonth: calendar.month,
          currentYear: calendar.year,
        }),
      ),
    ]),
  );

  // Only the delete handler is needed at screen level;
  // create + update are fully managed inside TransactionModal.
  const { handleDeleteTransaction } = useTransactionOperations();

  const { handleLoadMore, isLoadingMore, hasNextPage } =
    useTransactionLoadMore();

  /** Show skeleton only for true initial load, not while searching. */
  const [openSheet, setOpenSheet] = useState(false);
  const [editingTransaction, setEditingTransaction] =
    useState<TransactionItem | null>(null);

  const loaderMessage = useMemo(() => {
    if (isAdding) return "Adding transaction…";
    if (isEditing) return "Updating transaction…";
    if (isDeleting) return "Deleting transaction…";
    if (isFiltering) return "Filtering transactions…";
    return "";
  }, [isAdding, isEditing, isDeleting, isFiltering]);

  const isLoaderVisible = isAdding || isEditing || isDeleting || isFiltering;

  /** Open the modal in edit mode for the given transaction. */
  const handleEditPress = useCallback((tx: TransactionItem) => {
    setEditingTransaction(tx);
    setOpenSheet(true);
  }, []);

  /** Clear editing state when the modal closes. */
  const handleModalClose = useCallback(() => {
    setEditingTransaction(null);
  }, []);

  // ── Memoised render callbacks for SectionList ─────────────────────────
  const renderSectionHeader = useCallback(
    ({
      section,
    }: {
      section: { title: string; total: number; data: TransactionItem[] };
    }) => (
      <SectionHeader
        title={section.title}
        total={section.total}
        currencyCode={activeCurrency}
      />
    ),
    [activeCurrency],
  );

  // Note: the `TransactionItem` type is minimal and only includes the fields needed for display in the list. The full transaction details (including any additional fields) are passed to the modal when editing. This keeps the list rendering efficient while still allowing full access to transaction data when needed.
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

  // Key extractor for SectionList items — uses transaction ID if available, otherwise falls back to index. This ensures stable keys even for transactions that may not have an ID yet (e.g. newly created transactions that haven't been saved to the backend).
  const keyExtractor = useCallback(
    (item: TransactionItem, index: number) => item.id ?? String(index),
    [],
  );

  /** Memoised footer element — avoids re-creating the subtree every render. */
  const listFooter = useMemo(
    () => (
      <ListFooter
        hasNextPage={hasNextPage}
        isLoadingMore={isSearching ? false : isLoadingMore}
        hasTransactions={transactions.length > 0}
        onLoadMore={() =>
          handleLoadMore(
            normalizedQuery,
            selectedBudgetId,
            selectedMinAmount,
            selectedMaxAmount,
          )
        }
      />
    ),
    [
      hasNextPage,
      isLoadingMore,
      isSearching,
      transactions.length,
      handleLoadMore,
      normalizedQuery,
      selectedBudgetId,
      selectedMinAmount,
      selectedMaxAmount,
    ],
  );

  /** Fixed top content (title + search + filters). */
  const fixedTopContent = useMemo(
    () => (
      <>
        {/* Screen title */}
        <View className="flex justify-center items-start mt-4 mb-2">
          <Text
            style={{ color: THEME.textPrimary }}
            className="text-2xl font-bold"
          >
            Transactions
          </Text>
        </View>

        {/* Ledger readout */}
        <FlowHeader
          transactions={displayTransactions}
          month={calendar.month}
          year={calendar.year}
          monthlyIncome={monthlyIncome}
          actualIncome={Number(financialSummary?.actualIncome || 0)}
          expectedIncome={Number(financialSummary?.expectedIncome || 0)}
          currencyCode={activeCurrency}
        />

        {/* Search bar */}
        <SearchBar
          searchQuery={searchQuery}
          setSearchQuery={handleSearchQueryChange}
          placeholder="Search transactions..."
        />

        {/* Category + amount filters */}
        <FilterTransaction
          budgets={budgets}
          filterCategoryId={filterCategoryId}
          setFilterCategoryId={setFilterCategoryId}
          minAmount={minAmount}
          setMinAmount={setMinAmount}
          maxAmount={maxAmount}
          setMaxAmount={setMaxAmount}
          clearFilters={clearFilters}
        />
      </>
    ),
    [
      THEME.textPrimary,
      searchQuery,
      handleSearchQueryChange,
      budgets,
      filterCategoryId,
      setFilterCategoryId,
      minAmount,
      setMinAmount,
      maxAmount,
      setMaxAmount,
      clearFilters,
      displayTransactions,
      calendar.month,
      calendar.year,
      monthlyIncome,
      activeCurrency,
    ],
  );

  /** True only for the genuine first load (no data yet, not searching). */
  const isInitialLoading =
    isLoading &&
    transactions.length === 0 &&
    !isSearching &&
    !suppressInitialSkeleton;

  /** Empty state shown when no transactions match the current filters. */
  const listEmpty = useMemo(
    () => (
      <View className="py-12 items-center">
        {isInitialLoading ? (
          <ActivityIndicator size="large" color={THEME.primary} />
        ) : (
          <Text style={{ color: THEME.textSecondary }}>
            No transactions match filters.
          </Text>
        )}
      </View>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isInitialLoading, THEME.textPrimary, THEME.textSecondary],
  );

  return (
    <SafeAreaView
      edges={["left", "right"]}
      style={{ backgroundColor: THEME.background, flex: 1 }}
      className="px-4"
    >
      {fixedTopContent}

      <SectionList
        sections={sectionsWithTotals}
        keyExtractor={keyExtractor}
        renderSectionHeader={renderSectionHeader as any}
        renderItem={renderItem as any}
        contentContainerStyle={{ paddingBottom: 120, paddingTop: 8 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={listEmpty}
        ListFooterComponent={listFooter}
        refreshControl={
          <RefreshControl
            refreshing={isSearching ? false : refreshing}
            onRefresh={onRefresh}
            progressBackgroundColor={THEME.background}
            colors={[THEME.primary]}
          />
        }
      />

      {/* Create / Edit modal — self-contained via useTransactionOperations */}
      <TransactionModal
        openSheet={openSheet}
        setOpenSheet={setOpenSheet}
        editingTransaction={editingTransaction}
        onClose={handleModalClose}
      />

      {/* Floating action button */}
      <AddNewTransactionButton setOpenSheet={setOpenSheet} />

      {/* Full-screen loader overlay */}
      {isLoaderVisible ? <Loader msg={loaderMessage} /> : null}
    </SafeAreaView>
  );
}
