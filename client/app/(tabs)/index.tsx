import React, { useCallback, useEffect, useMemo, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { RefreshControl, ScrollView, View } from "react-native";
import { useAppDispatch } from "@/store";
import { nextMonth, prevMonth } from "@/store/slices/calendarSlice";
import { fetchTransaction } from "@/store/slices/transactionSlice";
import { fetchFinancialSummary } from "@/store/slices/financialSummarySlice";
import { fetchBudgets } from "@/store/slices/budgetSlice";
import { useThemedAlert } from "@/utils/themedAlert";
import TransactionModal from "@/components/transaction/TxModal";
import BudgetModal from "@/components/budget/BudgetModal";
import InformationModal from "@/components/home/informationModal";
import HomeHeader from "@/components/home/HomeHeader";
import MonthSelector from "@/components/home/MonthSelector";
import HomePulse from "@/components/home/HomePulse";
import SpendingRhythm from "@/components/home/SpendingRhythm";
import BudgetPulse from "@/components/home/BudgetPulse";
import GoalPulse from "@/components/home/GoalPulse";
import RecentFlow from "@/components/home/RecentFlow";
import QuickActions from "@/components/home/QuickActions";
import { useTransactionDisplayAmounts } from "@/hooks/transaction/useTransactionDisplayAmounts";
import { convertCurrency } from "@/utils/currencyConverter";
import {
  useTheme,
  useTransactions,
  useBudgets,
  useGoals,
  useCalendar,
  useUser,
  useFinancialSummary,
} from "@/hooks/useRedux";
import { useBudgetDisplayAmounts } from "@/hooks/budget/useBudgetDisplayAmounts";
import { PAGINATION_LIMIT } from "@/constants/appConfig";

export default function Index() {
  const { THEME } = useTheme();
  const { showAlert } = useThemedAlert();
  const transactions = useTransactions();
  const budgets = useBudgets();
  const goals = useGoals();
  const user = useUser();
  const activeCurrency = user?.currency || "USD";
  const calendar = useCalendar();
  const financialSummary = useFinancialSummary();
  const dispatch = useAppDispatch();
  const { displayTransactions } = useTransactionDisplayAmounts(
    transactions,
    activeCurrency,
  );
  const { displayBudgets } = useBudgetDisplayAmounts(
    budgets,
    transactions,
    activeCurrency,
  );
  const [convertedExpenseTotal, setConvertedExpenseTotal] = useState(
    Number(financialSummary?.totalAmount || 0),
  );

  const [helpOpen, setHelpOpen] = useState(false);
  const [openTxModal, setOpenTxModal] = useState(false);
  const [openBudgetModal, setOpenBudgetModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        dispatch(
          fetchTransaction({
            searchQuery: "",
            currentMonth: calendar.month,
            currentYear: calendar.year,
            page: 1,
            limit: PAGINATION_LIMIT,
            useCache: false,
          }),
        ),
        dispatch(
          fetchFinancialSummary({
            currentMonth: calendar.month,
            currentYear: calendar.year,
          }),
        ),
        dispatch(
          fetchBudgets({
            currentMonth: calendar.month,
            currentYear: calendar.year,
          }),
        ),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [dispatch, calendar.month, calendar.year]);

  useEffect(() => {
    void Promise.all([
      dispatch(
        fetchTransaction({
          searchQuery: "",
          currentMonth: calendar.month,
          currentYear: calendar.year,
          page: 1,
          limit: PAGINATION_LIMIT,
          useCache: true,
        }),
      ),
      dispatch(
        fetchFinancialSummary({
          currentMonth: calendar.month,
          currentYear: calendar.year,
        }),
      ),
      dispatch(
        fetchBudgets({
          currentMonth: calendar.month,
          currentYear: calendar.year,
        }),
      ),
    ]);
  }, [dispatch, calendar.month, calendar.year]);

const monthStartDate = useMemo(
    () => new Date(calendar.year, calendar.month, 1),
    [calendar.year, calendar.month],
  );

  const monthLabel = useMemo(
    () =>
      `${monthStartDate.toLocaleString(undefined, { month: "long" })} ${calendar.year}`,
    [monthStartDate, calendar.year],
  );

  const expenseTotal = convertedExpenseTotal;
  const monthlyIncome = Number(financialSummary?.monthlyIncome || 0);

  useEffect(() => {
    let cancelled = false;

    const normalize = (v: string | null | undefined) =>
      String(v || "")
        .trim()
        .toUpperCase();

    const inferSourceCurrency = () => {
      const counts = new Map<string, number>();
      for (const tx of transactions as any[]) {
        if ((tx?.type ?? "EXPENSE").toUpperCase() !== "EXPENSE") continue;
        const c = normalize(tx?.baseCurrency || tx?.originalCurrency);
        if (!c) continue;
        counts.set(c, (counts.get(c) || 0) + 1);
      }
      let winner = "";
      let max = 0;
      for (const [currency, count] of counts.entries()) {
        if (count > max) {
          max = count;
          winner = currency;
        }
      }
      return winner || normalize(user?.currency) || "USD";
    };

    const run = async () => {
      const rawTotal = Number(financialSummary?.totalAmount || 0);
      const toCurrency = normalize(activeCurrency) || "USD";
      const fromCurrency = inferSourceCurrency();

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

  const now = new Date();
  const isCurrentMonth =
    calendar.month === now.getMonth() && calendar.year === now.getFullYear();

  /* Guard: a budget must exist for the month before a transaction can be added. */
  const handleNewTransaction = () => {
    if (budgets.length === 0) {
      showAlert({
        title: "No budgets available",
        message: "No budgets exist for this month. Please create a budget first.",
      });
      return;
    }
    setOpenTxModal(true);
  };

  return (
    <SafeAreaView
      edges={["left", "right"]}
      style={{ flex: 1, backgroundColor: THEME.background }}
    >
      <ScrollView
        contentContainerStyle={{ padding: 16 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            progressBackgroundColor={THEME.background}
            colors={[THEME.primary]}
          />
        }
      >
        <HomeHeader onInfoPress={() => setHelpOpen(true)} />

        <MonthSelector
          monthLabel={monthLabel}
          isCurrentMonth={isCurrentMonth}
          onPrev={() => dispatch(prevMonth())}
          onNext={() => dispatch(nextMonth())}
        />

        <HomePulse
          monthlyIncome={monthlyIncome}
          totalSpent={expenseTotal}
          monthLabel={monthLabel}
          currencyCode={activeCurrency}
          isCurrentMonth={isCurrentMonth}
        />

        <SpendingRhythm
          transactions={transactions}
          month={calendar.month}
          year={calendar.year}
          currencyCode={activeCurrency}
        />

        <BudgetPulse budgets={displayBudgets} currencyCode={activeCurrency} />

        <GoalPulse goals={goals} currencyCode={activeCurrency} />

        <RecentFlow transactions={displayTransactions} currencyCode={activeCurrency} />

        <QuickActions
          onNewTransaction={handleNewTransaction}
          onNewBudget={() => setOpenBudgetModal(true)}
        />

        <View style={{ height: 80 }} />
      </ScrollView>

      {/* Modals */}
      <TransactionModal openSheet={openTxModal} setOpenSheet={setOpenTxModal} />
      <BudgetModal
        openSheet={openBudgetModal}
        setOpenSheet={setOpenBudgetModal}
      />
      <InformationModal helpOpen={helpOpen} setHelpOpen={setHelpOpen} />
    </SafeAreaView>
  );
}