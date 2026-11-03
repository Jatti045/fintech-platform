import React, { useMemo } from "react";
import { Text, View, useWindowDimensions } from "react-native";
import { useTheme } from "@/hooks/useRedux";
import Svg, { Circle } from "react-native-svg";
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
  const { width, fontScale } = useWindowDimensions();
  const compact = width < 600 || fontScale > 1.2;
  const percentage =
    stats.totalLimit > 0
      ? Math.round((stats.totalSpent / stats.totalLimit) * 100)
      : null;
  const categorySummary = `${stats.categoriesWithLimits} of ${stats.budgetCount} categories have limits · ${stats.onTrack} on track · ${stats.nearLimit} near / without limits · ${stats.overLimit} over limit`;
  const diameter = width < 600 ? 90 : 108;
  const radius = (diameter - 9) / 2;
  const circumference = 2 * Math.PI * radius;
  return (
    <DashboardCard padding={16} style={{ marginBottom: 16 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
        <View
          accessibilityRole="progressbar"
          accessibilityLabel="Overall budget progress"
          accessibilityValue={{
            min: 0,
            max: 100,
            now: Math.round(stats.utilization * 100),
            text:
              percentage == null
                ? "No budget limits set"
                : `${percentage}% of limits used${overspent ? ", over budget" : ""}`,
          }}
          style={{ width: diameter, height: diameter, flexShrink: 0 }}
        >
          <Svg
            width={diameter}
            height={diameter}
            viewBox={`0 0 ${diameter} ${diameter}`}
          >
            <Circle
              cx={diameter / 2}
              cy={diameter / 2}
              r={radius}
              stroke={THEME.border}
              strokeWidth={9}
              fill="none"
            />
            {stats.utilization > 0 && (
              <Circle
                cx={diameter / 2}
                cy={diameter / 2}
                r={radius}
                stroke={tone}
                strokeWidth={9}
                fill="none"
                strokeLinecap="round"
                strokeDasharray={`${circumference} ${circumference}`}
                strokeDashoffset={circumference * (1 - stats.utilization)}
                rotation={-90}
                origin={`${diameter / 2}, ${diameter / 2}`}
              />
            )}
          </Svg>
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text
              style={{
                color: THEME.textPrimary,
                fontSize: 23,
                fontWeight: "800",
                letterSpacing: -0.7,
              }}
            >
              {percentage == null ? "—" : `${percentage}%`}
            </Text>
            <Text style={{ color: THEME.textSecondary, fontSize: 10 }}>
              {percentage == null ? "no limits" : "of budget"}
            </Text>
          </View>
        </View>
        <View
          style={{
            flex: 1,
            minWidth: 0,
            borderLeftWidth: 1,
            borderLeftColor: THEME.border,
            paddingLeft: 16,
          }}
        >
          <Text
            accessibilityRole="header"
            style={{
              color: THEME.textPrimary,
              fontSize: 19,
              fontWeight: "700",
              letterSpacing: -0.5,
            }}
          >
            Monthly Summary
          </Text>
          <Text
            style={{ color: THEME.textSecondary, fontSize: 10, marginTop: 6 }}
          >
            {formattedHeaderMonth}
          </Text>
          {!compact && metrics()}
        </View>
      </View>
      {compact && metrics()}
      <Text
        style={{
          color: overspent ? THEME.danger : THEME.textSecondary,
          fontSize: 11,
          lineHeight: 17,
          marginTop: 10,
        }}
      >
        {stats.totalLimit <= 0
          ? `No budget limits set · ${categorySummary}`
          : overspent
            ? `Over budget by ${formatCurrency(stats.totalSpent - stats.totalLimit, currencyCode)} · ${categorySummary}`
            : categorySummary}
      </Text>
    </DashboardCard>
  );

  function metrics() {
    return (
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 8,
          marginTop: compact ? 16 : 12,
        }}
      >
        {[
          { label: "Total budgeted", amount: stats.totalLimit },
          { label: "Spent", amount: stats.totalSpent },
          { label: "Remaining", amount: stats.remaining },
        ].map((item, index) => (
          <View
            key={item.label}
            style={{
              flexGrow: 1,
              flexBasis: 110,
              minWidth: 110,
              borderLeftWidth: index ? 1 : 0,
              borderLeftColor: THEME.border,
              paddingLeft: index ? 8 : 0,
            }}
          >
            <Text style={{ color: THEME.textSecondary, fontSize: 11 }}>
              {item.label}
            </Text>
            <Text
              style={{
                color:
                  index === 2
                    ? item.amount < 0
                      ? THEME.danger
                      : THEME.primary
                    : THEME.textPrimary,
                fontSize: 17,
                fontWeight: "700",
                fontVariant: ["tabular-nums"],
                marginTop: 5,
              }}
            >
              {formatCurrency(item.amount, currencyCode)}
            </Text>
          </View>
        ))}
      </View>
    );
  }
});
export default BudgetHalo;
