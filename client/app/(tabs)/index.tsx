import React from "react";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { RefreshControl, ScrollView, View } from "react-native";
import { BRAND } from "@/constants/ThemePalettes";
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
import RecentTransactions from "@/components/home/RecentTransactions";
import BudgetOverview from "@/components/home/BudgetOverview";
import DashboardState from "@/components/home/DashboardState";
import DashboardCard from "@/components/home/DashboardCard";

/** Home uses server-owned reporting values; interactions stay in the existing hooks and routes. */
export default function Index() {
  const home = useHomeScreen();
  const { THEME } = useTheme();
  const { reporting } = home;
  const report = reporting.report;
  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={{ flex: 1, backgroundColor: THEME.background }}
    >
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: BRAND.spacing.md,
          paddingTop: BRAND.spacing.md,
          paddingBottom: BRAND.spacing.xl,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={home.refreshing}
            onRefresh={home.onRefresh}
            progressBackgroundColor={THEME.surface}
            colors={[THEME.primary]}
            tintColor={THEME.primary}
          />
        }
      >
        <View style={{ width: "100%", maxWidth: 680, alignSelf: "center" }}>
          <HomeHeader
            onInfoPress={home.handleInfoPress}
            onSettingsPress={() => router.push("/(tabs)/profile")}
          />
          <MonthSelector
            monthLabel={home.monthLabel}
            isCurrentMonth={home.isCurrentMonth}
            onPrev={home.handlePrevMonth}
            onNext={home.handleNextMonth}
          />
          {!report && reporting.isFetching ? (
            <DashboardCard padding={BRAND.spacing.lg}>
              <DashboardState loading message="Loading financial report…" />
            </DashboardCard>
          ) : (
            <ReportStatus
              report={report}
              loading={reporting.isFetching}
              error={reporting.error}
              stale={reporting.stale}
              onRetry={() => {
                void reporting.refetch();
              }}
            />
          )}
          {report && (
            <>
              <MonthlyOverview
                monthlyIncome={home.monthlyIncome}
                totalSpent={home.expenseTotal}
                monthLabel={home.monthLabel}
                currencyCode={report.currency}
                isCurrentMonth={home.isCurrentMonth}
                daily={report.daily}
                month={home.month}
                year={home.year}
                report={report}
              />
              <FinancialMetrics
                monthlyIncome={home.monthlyIncome}
                totalSpent={home.expenseTotal}
                currencyCode={report.currency}
                report={report}
              />
              <BudgetOverview
                report={report}
                onOpenBudgets={() => router.push("/(tabs)/budget")}
              />
            </>
          )}
          <RecentTransactions
            transactions={
              home.transactionsLoading ? [] : home.displayTransactions
            }
            currencyCode={home.activeCurrency}
            loading={home.transactionsLoading}
            error={home.transactionsError}
            onRetry={home.retryTransactions}
            onSeeAll={() => router.push("/(tabs)/transaction")}
          />
          <UpcomingBillsCard
            bills={home.upcomingBills}
            currencyCode={home.activeCurrency}
            onDismiss={home.handleDismissBill}
            loading={home.billsLoading}
            error={home.billsError}
            onRetry={home.retryBills}
          />
          <MonthlyInsightCard month={home.month} year={home.year} />
        </View>
      </ScrollView>
      <InformationModal
        helpOpen={home.helpOpen}
        setHelpOpen={home.setHelpOpen}
      />
    </SafeAreaView>
  );
}
