import React, { useMemo } from "react";
import { View, Text } from "react-native";
import { formatCurrency } from "@/utils/helper";
import { useTheme } from "@/hooks/useRedux";
import { BRAND } from "@/constants/ThemePalettes";
import type { IFinancialReport } from "@/types/financialSummary/types";
import DashboardCard from "./DashboardCard";

export interface MonthlyOverviewProps {
  monthlyIncome: number;
  totalSpent: number;
  monthLabel: string;
  currencyCode: string;
  isCurrentMonth: boolean;
  daily?: { day: number; netSpent: number }[];
  month?: number;
  year?: number;
  report?: IFinancialReport;
}

export default function MonthlyOverview({
  monthlyIncome,
  totalSpent,
  currencyCode,
  daily = [],
  month,
  year,
  report,
}: MonthlyOverviewProps) {
  const income = Math.max(0, monthlyIncome || 0);
  const net = report?.summary.netRemaining ?? income - totalSpent;
  const spentPercent = Math.round(
    report?.summary.spentPercentageOfIncome ??
      (income > 0 ? totalSpent / income : 0) * 100,
  );
  // Render the authoritative daily series for the last eight reporting days.
  const trendBars = useMemo(() => {
    const now = new Date();
    const targetMonth = month ?? now.getUTCMonth();
    const targetYear = year ?? now.getUTCFullYear();
    const daysInMonth = new Date(
      Date.UTC(targetYear, targetMonth + 1, 0),
    ).getUTCDate();
    const todayDate = now.getUTCDate();

    const endDay =
      targetMonth === now.getUTCMonth() && targetYear === now.getUTCFullYear()
        ? Math.min(todayDate, daysInMonth)
        : daysInMonth;
    const startDay = Math.max(1, endDay - 7);

    const dailyTotals: number[] = [];
    for (let d = startDay; d <= endDay; d++) {
      const sum = daily.find((point) => point.day === d)?.netSpent ?? 0;
      dailyTotals.push(sum);
    }

    while (dailyTotals.length < 8) {
      dailyTotals.unshift(0);
    }

    const maxVal = Math.max(1, ...dailyTotals.map(Math.abs));
    const highlightIdx = dailyTotals.length - 1;

    return dailyTotals.map((val, idx) => {
      const h =
        val !== 0 ? Math.max(2, Math.round((Math.abs(val) / maxVal) * 44)) : 0;
      return {
        height: h,
        value: val,
        day: startDay + idx - (8 - (endDay - startDay + 1)),
        isHighlight: idx === highlightIdx,
      };
    });
  }, [daily, month, year]);

  const { THEME } = useTheme();
  return (
    <DashboardCard
      padding={BRAND.spacing.lg}
      style={{
        marginBottom: BRAND.spacing.md,
        backgroundColor: THEME.subtleSurface,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: BRAND.spacing.sm,
          marginBottom: BRAND.spacing.md,
        }}
      >
        <Text
          accessibilityRole="header"
          style={{ color: THEME.textPrimary, fontSize: 15, fontWeight: "700" }}
        >
          Monthly overview
        </Text>
        <Text style={{ color: THEME.textSecondary, fontSize: 12 }}>
          {currencyCode} ·{" "}
          {report?.incomeBasis === "EXPECTED"
            ? "Expected income basis"
            : report?.incomeBasis === "UNCONFIGURED"
              ? "Income not configured"
              : "Recorded income basis"}
        </Text>
      </View>
      <Text
        accessibilityLabel={`${formatCurrency(net, currencyCode)} ${net < 0 ? "over income" : "income remaining"}`}
        style={{
          color: net < 0 ? THEME.danger : THEME.textPrimary,
          fontSize: 38,
          fontWeight: "800",
          letterSpacing: -1.3,
          fontVariant: ["tabular-nums"],
        }}
      >
        {formatCurrency(net, currencyCode)}
      </Text>
      <Text
        style={{
          color: THEME.textSecondary,
          fontSize: 14,
          marginTop: BRAND.spacing.xs,
          marginBottom: BRAND.spacing.lg,
        }}
      >
        {net < 0 ? "over income" : "income remaining"}
      </Text>
      <View
        accessibilityRole="progressbar"
        accessibilityValue={{
          min: 0,
          max: 100,
          now: Math.max(0, Math.min(100, spentPercent)),
          text:
            income > 0
              ? `${spentPercent}% of income spent`
              : "No income available for percentage",
        }}
        style={{
          height: 7,
          borderRadius: 4,
          backgroundColor: THEME.border,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            width: `${Math.max(0, Math.min(100, spentPercent))}%`,
            height: 7,
            backgroundColor: net < 0 ? THEME.danger : THEME.primary,
            borderRadius: 4,
          }}
        />
      </View>
      <Text
        style={{
          color: THEME.textSecondary,
          fontSize: 12,
          lineHeight: 19,
          marginTop: BRAND.spacing.sm,
        }}
      >
        {income > 0
          ? `${spentPercent}% of income spent`
          : "No income available for percentage"}
      </Text>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: BRAND.spacing.md,
          flexWrap: "wrap",
          marginTop: BRAND.spacing.lg,
          borderTopWidth: 1,
          borderTopColor: THEME.border,
          paddingTop: BRAND.spacing.md,
        }}
      >
        <View style={{ flexShrink: 1 }}>
          <Text
            style={{
              color: THEME.textPrimary,
              fontSize: 13,
              fontWeight: "600",
            }}
          >
            Spending trend
          </Text>
          <Text
            style={{
              color: THEME.textSecondary,
              fontSize: 12,
              marginTop: BRAND.spacing.xs,
            }}
          >
            Last 8 reporting days
          </Text>
        </View>
        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-end",
            height: 58,
            gap: 8,
          }}
        >
          {trendBars.map((bar, i) => (
            <View
              key={i}
              accessible={bar.day > 0}
              accessibilityLabel={`Day ${bar.day}: ${formatCurrency(bar.value, currencyCode)} net spending`}
              style={{ height: 58, justifyContent: "flex-end" }}
            >
              <View
                style={{
                  width: 5,
                  height: bar.height,
                  borderRadius: 3,
                  backgroundColor:
                    bar.value < 0
                      ? THEME.warning
                      : bar.isHighlight
                        ? THEME.success
                        : THEME.primary,
                  opacity: bar.isHighlight || bar.value < 0 ? 1 : 0.4,
                }}
              />
            </View>
          ))}
        </View>
      </View>
    </DashboardCard>
  );
}
