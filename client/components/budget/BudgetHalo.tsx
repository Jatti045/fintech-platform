import React, { useMemo } from "react";
import { Text, View } from "react-native";
import { useTheme } from "@/hooks/useRedux";
import { BRAND } from "@/constants/ThemePalettes";
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

/** The established monthly totals and thresholds, presented without a fixed-size dial. */
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
    ? monthLabel.toUpperCase()
    : `${monthLabel} ${displayYear}`.toUpperCase();
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
  return (
    <View
      style={{
        backgroundColor: THEME.subtleSurface,
        borderRadius: BRAND.radius.card,
        borderWidth: 1,
        borderColor: THEME.border,
        padding: BRAND.spacing.lg,
        marginBottom: BRAND.spacing.md,
      }}
    >
      <Text
        style={{
          color: THEME.textSecondary,
          fontSize: 12,
          fontWeight: "600",
          marginBottom: BRAND.spacing.md,
        }}
      >
        {formattedHeaderMonth}
      </Text>
      <Text
        style={{
          color: THEME.textSecondary,
          fontSize: 12,
          marginBottom: BRAND.spacing.sm,
        }}
      >
        {stats.budgetCount} categories
      </Text>
      <Text
        accessibilityRole="header"
        style={{ color: THEME.textPrimary, fontSize: 15, fontWeight: "700" }}
      >
        Monthly spending
      </Text>
      <Text
        style={{
          color: THEME.textPrimary,
          fontSize: 34,
          fontWeight: "800",
          letterSpacing: -1,
          fontVariant: ["tabular-nums"],
          marginTop: BRAND.spacing.sm,
        }}
      >
        {formatCurrency(stats.totalSpent, currencyCode)}
      </Text>
      <View
        accessibilityRole="progressbar"
        accessibilityLabel="Overall budget progress"
        accessibilityValue={{
          min: 0,
          max: 100,
          now: Math.round(stats.utilization * 100),
          text:
            stats.totalLimit > 0
              ? `${Math.round(stats.utilization * 100)}% of limits used${overspent ? ", over budget" : ""}`
              : "No budget limits set",
        }}
        style={{
          height: 7,
          borderRadius: 4,
          overflow: "hidden",
          backgroundColor: THEME.border,
          marginTop: BRAND.spacing.lg,
        }}
      >
        <View
          style={{
            width: `${stats.utilization * 100}%`,
            height: 7,
            backgroundColor: tone,
            borderRadius: 4,
          }}
        />
      </View>
      <Text
        style={{
          color: overspent ? THEME.danger : THEME.textSecondary,
          fontSize: 13,
          lineHeight: 20,
          marginTop: BRAND.spacing.sm,
        }}
      >
        {stats.totalLimit <= 0
          ? "No budget limits set"
          : overspent
            ? `Over budget by ${formatCurrency(stats.totalSpent - stats.totalLimit, currencyCode)}`
            : `${Math.round(stats.utilization * 100)}% of limits used`}
      </Text>
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: BRAND.spacing.md,
          marginTop: BRAND.spacing.lg,
        }}
      >
        {[
          { label: "Total budgeted", amount: stats.totalLimit },
          { label: "Budget remaining", amount: stats.remaining },
        ].map((item) => (
          <View key={item.label} style={{ flexGrow: 1, flexBasis: 120 }}>
            <Text style={{ color: THEME.textSecondary, fontSize: 12 }}>
              {item.label}
            </Text>
            <Text
              style={{
                color:
                  item.label === "Budget remaining" && item.amount < 0
                    ? THEME.danger
                    : THEME.textPrimary,
                fontSize: 19,
                fontWeight: "700",
                fontVariant: ["tabular-nums"],
                marginTop: 4,
              }}
            >
              {formatCurrency(item.amount, currencyCode)}
            </Text>
          </View>
        ))}
      </View>
      <Text
        style={{
          color: THEME.textSecondary,
          fontSize: 12,
          lineHeight: 19,
          marginTop: BRAND.spacing.md,
        }}
      >
        {stats.categoriesWithLimits} of {stats.budgetCount} categories have
        limits · {stats.onTrack} on track · {stats.nearLimit} near / without
        limits · {stats.overLimit} over limit
      </Text>
    </View>
  );
});
export default BudgetHalo;
