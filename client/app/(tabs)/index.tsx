import React from "react";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { RefreshControl, ScrollView, View } from "react-native";
import { useHomeScreen } from "@/hooks/home/useHomeScreen";
import { useTheme } from "@/hooks/useRedux";
import UpcomingBillsCard from "@/components/home/UpcomingBillsCard";
import InformationModal from "@/components/home/informationModal";
import HomeHeader from "@/components/home/HomeHeader";
import MonthSelector from "@/components/home/MonthSelector";
import ReportStatus from "@/components/reporting/ReportStatus";
import MonthlyOverview from "@/components/home/MonthlyOverview";
import FinancialMetrics from "@/components/home/FinancialMetrics";
import MonthlyInsightCard from "@/components/home/MonthlyInsightCard";
import BudgetOverview from "@/components/home/BudgetOverview";
import RecentTransactions from "@/components/home/RecentTransactions";

/**
 * Budgee Dashboard (Home Tab).
 *
 * Minimal, premium, polished, clean, and highly legible financial product UI.
 * Rebuilt to closely match the reference design:
 *   - Dark near-black background (#0B0B0D)
 *   - Restrained surfaces, hairline subtle borders (#232326), no glassmorphic glow
 *   - Clear hierarchy: Budgee Header → Month Selector → Monthly Overview
 *     → 3 Metrics (Income/Spent/Net) → Explain My Month → Upcoming Bills
 *     → Budget Overview → Recent Transactions
 */
export default function Index() {
  const {
    reporting,
    displayTransactions,
    displayBudgets,
    budgetsLoading,
    budgetsError,
    retryBudgets,
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
    setHelpOpen,
    refreshing,
    onRefresh,
    handlePrevMonth,
    handleNextMonth,
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
        <ReportStatus
          report={reporting.report}
          loading={reporting.isFetching}
          error={reporting.error}
          stale={reporting.stale}
          onRetry={() => {
            void reporting.refetch();
          }}
        />
        {reporting.report && (
          <>
            <MonthlyOverview
              monthlyIncome={monthlyIncome}
              totalSpent={expenseTotal}
              monthLabel={monthLabel}
              currencyCode={reporting.report.currency}
              isCurrentMonth={isCurrentMonth}
              daily={reporting.report.daily}
              month={month}
              year={year}
            />

            {/* 4. Three Metrics: Income / Spent / Net */}
            <FinancialMetrics
              monthlyIncome={monthlyIncome}
              totalSpent={expenseTotal}
              currencyCode={reporting.report.currency}
            />
          </>
        )}

        {/* 5. Explain My Month: AI feature panel */}
        <MonthlyInsightCard month={month} year={year} />

        {/* 6. Upcoming Bills: Spotify, Netflix, OpenAI compact cards */}
        <UpcomingBillsCard
          bills={upcomingBills}
          currencyCode={activeCurrency}
          onDismiss={handleDismissBill}
        />

        <BudgetOverview
          budgets={displayBudgets}
          currencyCode={activeCurrency}
          loading={budgetsLoading}
          error={budgetsError}
          onRetry={retryBudgets}
        />

        {/* 7. Recent Transactions: unified subtle surface */}
        <RecentTransactions
          transactions={displayTransactions}
          currencyCode={activeCurrency}
        />

        <View style={{ height: 40 }} />
      </ScrollView>

      <InformationModal helpOpen={helpOpen} setHelpOpen={setHelpOpen} />
    </SafeAreaView>
  );
}
