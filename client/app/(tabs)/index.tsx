import React from "react";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { RefreshControl, ScrollView, View } from "react-native";
import { useHomeScreen } from "@/hooks/home/useHomeScreen";
import { useTheme } from "@/hooks/useRedux";
import TransactionModal from "@/components/transaction/TxModal";
import BudgetModal from "@/components/budget/BudgetModal";
import { MonthSetupModal } from "@/components/budget";
import UpcomingBillsCard from "@/components/home/UpcomingBillsCard";
import InformationModal from "@/components/home/informationModal";
import HomeHeader from "@/components/home/HomeHeader";
import MonthSelector from "@/components/home/MonthSelector";
import MonthlyOverview from "@/components/home/MonthlyOverview";
import FinancialMetrics from "@/components/home/FinancialMetrics";
import MonthlyInsightCard from "@/components/home/MonthlyInsightCard";
import RecentTransactions from "@/components/home/RecentTransactions";
import QuickActions from "@/components/home/QuickActions";

/**
 * Budgee Dashboard (Home Tab).
 *
 * Minimal, premium, polished, clean, and highly legible financial product UI.
 * Rebuilt to closely match the reference design:
 *   - Dark near-black background (#0B0B0D)
 *   - Restrained surfaces, hairline subtle borders (#232326), no glassmorphic glow
 *   - Clear hierarchy: Budgee Header → Month Selector → Monthly Overview
 *     → 3 Metrics (Income/Spent/Net) → Explain My Month → Upcoming Bills
 *     → Recent Transactions → Quick Actions
 *   - All Redux, RTK Query, calculations, and modal logic preserved
 */
export default function Index() {
  const {
    transactions,
    displayTransactions,
    activeCurrency,
    monthlyIncome,
    expenseTotal,
    monthLabel,
    isCurrentMonth,
    month,
    year,
    upcomingBills,
    handleDismissBill,
    helpOpen,
    openTxModal,
    openBudgetModal,
    openSetup,
    setHelpOpen,
    setOpenTxModal,
    setOpenBudgetModal,
    handleHideSetup,
    refreshing,
    onRefresh,
    handlePrevMonth,
    handleNextMonth,
    handleNewTransaction,
    handleNewBudget,
    handleInfoPress,
  } = useHomeScreen();

  const { THEME } = useTheme();

  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={{ flex: 1, backgroundColor: THEME.background }}
    >
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 8,
          paddingBottom: 24,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            progressBackgroundColor={THEME.surface}
            colors={[THEME.primary]}
            tintColor={THEME.primary}
          />
        }
      >
        {/* 1. Header: Budgee, Greeting, Info & Settings */}
        <HomeHeader
          onInfoPress={handleInfoPress}
          onSettingsPress={() => router.push("/(tabs)/profile")}
        />

        {/* 2. Month Selector: [ < ]  Month Year  [ > ] */}
        <MonthSelector
          monthLabel={monthLabel}
          isCurrentMonth={isCurrentMonth}
          onPrev={handlePrevMonth}
          onNext={handleNextMonth}
        />

        {/* 3. Main Monthly Overview: $2,005 left to spend, progress bar, spending trend */}
        <MonthlyOverview
          monthlyIncome={monthlyIncome}
          totalSpent={expenseTotal}
          monthLabel={monthLabel}
          currencyCode={activeCurrency}
          isCurrentMonth={isCurrentMonth}
          transactions={transactions}
          month={month}
          year={year}
        />

        {/* 4. Three Metrics: Income / Spent / Net */}
        <FinancialMetrics
          monthlyIncome={monthlyIncome}
          totalSpent={expenseTotal}
          currencyCode={activeCurrency}
        />

        {/* 5. Explain My Month: AI feature panel */}
        <MonthlyInsightCard month={month} year={year} />

        {/* 6. Upcoming Bills: Spotify, Netflix, OpenAI compact cards */}
        <UpcomingBillsCard
          bills={upcomingBills}
          currencyCode={activeCurrency}
          onDismiss={handleDismissBill}
        />

        {/* 7. Recent Transactions: unified subtle surface */}
        <RecentTransactions
          transactions={displayTransactions}
          currencyCode={activeCurrency}
        />

        {/* 8. Quick Actions: 4 compact action cards */}
        <QuickActions
          onNewTransaction={handleNewTransaction}
          onNewBudget={handleNewBudget}
        />

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Modals & Sheets */}
      <TransactionModal openSheet={openTxModal} setOpenSheet={setOpenTxModal} />
      <BudgetModal
        openSheet={openBudgetModal}
        setOpenSheet={setOpenBudgetModal}
      />
      <MonthSetupModal
        open={openSetup}
        onOpenChange={handleHideSetup}
        month={month}
        year={year}
        currencyCode={activeCurrency}
        monthLabel={monthLabel}
      />
      <InformationModal helpOpen={helpOpen} setHelpOpen={setHelpOpen} />
    </SafeAreaView>
  );
}
