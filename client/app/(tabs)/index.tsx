import FundleafLoader from "@/components/brand/FundleafLoader";
import React from "react";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { RefreshControl, ScrollView, View } from "react-native";
import { BRAND } from "@/constants/ThemePalettes";
import { useHomeScreen } from "@/hooks/home/useHomeScreen";
import { useTheme } from "@/hooks/useRedux";
import UpcomingBillsCard from "@/components/home/UpcomingBillsCard";
import HomeHeader from "@/components/home/HomeHeader";
import MonthlyOverview from "@/components/home/MonthlyOverview";
import RecentTransactions from "@/components/home/RecentTransactions";
import BudgetOverview from "@/components/home/BudgetOverview";
import DashboardState from "@/components/home/DashboardState";

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
          paddingHorizontal: BRAND.gutter,
          paddingTop: BRAND.spacing.sm,
          paddingBottom: BRAND.spacing.xl,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={home.refreshing}
            onRefresh={home.onRefresh}
            progressBackgroundColor="transparent"
            colors={["transparent"]}
            tintColor="transparent"
          />
        }
      >
        <View
          style={{
            width: "100%",
            maxWidth: BRAND.pageWidth,
            alignSelf: "center",
          }}
        >
          {home.refreshing && (
            <FundleafLoader
              color={THEME.primary}
              accessibilityLabel="Refreshing"
            />
          )}
          <HomeHeader
            onSettingsPress={() => router.push("/(tabs)/profile")}
            month={home.month}
            year={home.year}
            onMonthChange={home.handleMonthChange}
          />
          {(reporting.isLoading || reporting.error || reporting.stale) && (
            <DashboardState
              compact={Boolean(report)}
              loading={reporting.isLoading || reporting.stale}
              error={Boolean(reporting.error)}
              message={
                reporting.error
                  ? "Monthly report could not be refreshed."
                  : report
                    ? "Updating your monthly report…"
                    : "Loading your monthly report…"
              }
              onRetry={reporting.refetch}
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
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
