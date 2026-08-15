import React from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { RefreshControl, ScrollView, View } from "react-native";
import { useTheme } from "@/hooks/useRedux";
import { useHomeScreen } from "@/hooks/home/useHomeScreen";
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

/**
 * Home tab — a composition/orchestration layer only:
 *
 *  - `useHomeScreen` owns homepage state (fetching, refresh, currency
 *    conversion, month metadata, modal state, quick-action guards)
 *  - the `Home*` components are presentational
 *  - the modals are self-contained (TxModal / BudgetModal / InformationModal)
 */
export default function Index() {
  const { THEME } = useTheme();

  const {
    transactions,
    goals,
    displayTransactions,
    displayBudgets,
    activeCurrency,
    monthlyIncome,
    expenseTotal,
    monthLabel,
    isCurrentMonth,
    month,
    year,
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
  } = useHomeScreen();

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
        <HomeHeader onInfoPress={handleInfoPress} />

        <MonthSelector
          monthLabel={monthLabel}
          isCurrentMonth={isCurrentMonth}
          onPrev={handlePrevMonth}
          onNext={handleNextMonth}
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
          month={month}
          year={year}
          currencyCode={activeCurrency}
        />

        <BudgetPulse budgets={displayBudgets} currencyCode={activeCurrency} />

        <GoalPulse goals={goals} currencyCode={activeCurrency} />

        <RecentFlow
          transactions={displayTransactions}
          currencyCode={activeCurrency}
        />

        <QuickActions
          onNewTransaction={handleNewTransaction}
          onNewBudget={handleNewBudget}
        />

        <View style={{ height: 80 }} />
      </ScrollView>

      {/* Modals */}
      <TransactionModal openSheet={openTxModal} setOpenSheet={setOpenTxModal} />
      <BudgetModal openSheet={openBudgetModal} setOpenSheet={setOpenBudgetModal} />
      <InformationModal helpOpen={helpOpen} setHelpOpen={setHelpOpen} />
    </SafeAreaView>
  );
}
