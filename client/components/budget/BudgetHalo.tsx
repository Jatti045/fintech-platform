import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "@/hooks/useRedux";
import { BRAND, TYPE } from "@/constants/ThemePalettes";
import ProgressTrack from "@/components/global/ProgressTrack";
import DashboardCard from "@/components/home/DashboardCard";
import { formatCurrency } from "@/utils/helper";
import { safeAmount } from "@/utils/transaction/helpers";

export interface BudgetHaloItem {
  id: string;
  category?: string;
  displayLimit?: number;
  displaySpent?: number;
}
export interface BudgetHaloProps {
  budgets: BudgetHaloItem[];
  monthLabel: string;
  year?: number;
  currencyCode: string;
  monthlySpent?: number;
}

/** Existing monthly totals and thresholds, presented in the reference summary layout. */
const BudgetHalo = React.memo(function BudgetHalo({
  budgets,
  monthLabel,
  year,
  currencyCode,
  monthlySpent,
}: BudgetHaloProps) {
  const { THEME } = useTheme();
  const displayYear = year ?? new Date().getUTCFullYear();
  const formattedHeaderMonth = monthLabel.includes(String(displayYear))
    ? monthLabel
    : `${monthLabel} ${displayYear}`;
  const stats = useMemo(() => {
    let totalLimit = 0;
    let totalSpent = 0;
    let onTrack = 0;
    let nearLimit = 0;
    let overLimit = 0;
    let categoriesWithLimits = 0;

    for (const b of budgets) {
      const limit = safeAmount(b.displayLimit);
      const spent = safeAmount(b.displaySpent);
      totalLimit += limit;
      totalSpent += spent;

      if (limit > 0) {
        categoriesWithLimits++;
        const ratio = spent / limit;
        if (ratio > 1) {
          overLimit++;
        } else if (ratio >= 0.8) {
          nearLimit++;
        } else {
          onTrack++;
        }
      } else if (spent > 0) {
        nearLimit++;
      }
    }

    totalSpent = monthlySpent ?? totalSpent;
    return {
      totalLimit,
      totalSpent,
      remaining: totalLimit - totalSpent,
      utilization:
        totalLimit > 0 ? Math.max(0, Math.min(1, totalSpent / totalLimit)) : 0,
      onTrack,
      nearLimit,
      overLimit,
      categoriesWithLimits,
      budgetCount: budgets.length,
    };
  }, [budgets, monthlySpent]);

  const overspent = stats.totalSpent > stats.totalLimit && stats.totalLimit > 0;
  const tone = overspent
    ? THEME.danger
    : stats.utilization >= 0.8
      ? THEME.warning
      : THEME.primary;
  const percentage =
    stats.totalLimit > 0
      ? Math.round((stats.totalSpent / stats.totalLimit) * 100)
      : null;
  const progressText =
    percentage == null
      ? "No budget limits set"
      : `${percentage}% of limits used${overspent ? ", over budget" : ""}`;
  const hasLimits = percentage != null;

  return (
    <DashboardCard
      padding={BRAND.gutter}
      style={{
        marginBottom: BRAND.spacing.lg,
        gap: 12,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: THEME.border,
      }}
    >
      <View style={styles.line}>
        <Text
          accessibilityRole="header"
          style={[TYPE.label, { color: THEME.textSecondary }]}
        >
          {overspent
            ? "Over budget"
            : hasLimits
              ? "Left in your budget"
              : "Monthly spending"}
        </Text>
        <Text style={[TYPE.caption, { color: THEME.textSecondary }]}>
          {formattedHeaderMonth}
        </Text>
      </View>
      <Text
        style={[
          TYPE.total,
          { color: overspent ? THEME.danger : THEME.primary },
        ]}
      >
        {formatCurrency(
          hasLimits ? stats.remaining : stats.totalSpent,
          currencyCode,
        )}
      </Text>
      <View style={styles.summary}>
        <View style={styles.line}>
          <Text style={[TYPE.caption, { color: THEME.textSecondary }]}>
            {progressText}
          </Text>
          <Text style={[TYPE.caption, { color: THEME.textSecondary }]}>
            {stats.categoriesWithLimits} of {stats.budgetCount} categories
            budgeted
          </Text>
        </View>
        <ProgressTrack
          percent={Math.round(stats.utilization * 100)}
          label="Overall budget progress"
          description={progressText}
          color={tone}
        />
      </View>
      <View style={[styles.figures, { borderColor: THEME.border }]}>
        {[
          { label: "Spent", amount: stats.totalSpent },
          { label: "Total budgeted", amount: stats.totalLimit },
          ...(!hasLimits
            ? [{ label: "Unallocated difference", amount: stats.remaining }]
            : []),
        ].map(({ label, amount }) => (
          <View key={label} style={styles.figure}>
            <Text style={[TYPE.caption, { color: THEME.textSecondary }]}>
              {label}
            </Text>
            <Text style={[TYPE.amount, { color: THEME.textPrimary }]}>
              {formatCurrency(amount, currencyCode)}
            </Text>
          </View>
        ))}
      </View>
      <Text
        style={[
          TYPE.caption,
          { color: overspent ? THEME.danger : THEME.textSecondary },
        ]}
      >
        {overspent
          ? `Over budget by ${formatCurrency(-stats.remaining, currencyCode)} · `
          : ""}
        {stats.onTrack} on track · {stats.nearLimit} near or without limits ·{" "}
        {stats.overLimit} over limit
      </Text>
    </DashboardCard>
  );
});

const styles = StyleSheet.create({
  line: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: BRAND.spacing.sm,
  },
  summary: { gap: BRAND.spacing.sm },
  figures: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: BRAND.spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: BRAND.spacing.md,
  },
  figure: { flexGrow: 1, flexBasis: 110, gap: BRAND.spacing.xs },
});

export default BudgetHalo;
