import React from "react";
import { View, Text } from "react-native";
import { Feather } from "@expo/vector-icons";
import { formatCurrency } from "@/utils/helper";
import { useTheme } from "@/hooks/useRedux";
import { BRAND } from "@/constants/ThemePalettes";
import DashboardCard from "./DashboardCard";
import type { IFinancialReport } from "@/types/financialSummary/types";

export interface FinancialMetricsProps {
  monthlyIncome: number;
  totalSpent: number;
  currencyCode: string;
  report?: IFinancialReport;
}
export default function FinancialMetrics({
  monthlyIncome,
  totalSpent,
  currencyCode,
  report,
}: FinancialMetricsProps) {
  const { THEME } = useTheme();
  const income = Math.max(0, monthlyIncome || 0);
  const net = report?.summary.netRemaining ?? income - totalSpent;
  const comparison = (
    value: number | null | undefined,
    empty: string,
    label: string,
  ) =>
    value == null
      ? empty
      : `${value > 0 ? "+" : ""}${value}% ${label} vs. last month`;
  const rows = [
    {
      label: "Income",
      amount: income,
      icon: "arrow-down-left" as const,
      color: THEME.success,
      detail: comparison(
        report?.previousPeriod.incomeChangePercentage,
        "No prior income basis",
        "recorded income",
      ),
    },
    {
      label: "Net spending",
      amount: totalSpent,
      icon: "arrow-up-right" as const,
      color: THEME.textPrimary,
      detail: comparison(
        report?.previousPeriod.spendingChangePercentage,
        "No prior spending basis",
        "net spending",
      ),
    },
    {
      label: "Net",
      amount: net,
      icon: "minus" as const,
      color: net < 0 ? THEME.danger : THEME.primary,
      detail:
        report?.incomeBasis === "EXPECTED"
          ? "Using expected income"
          : "Income less net spending",
    },
  ];
  return (
    <DashboardCard
      paddingHorizontal={BRAND.spacing.md}
      style={{ marginBottom: BRAND.spacing.lg }}
    >
      {rows.map((row, i) => (
        <View
          key={row.label}
          style={{
            paddingVertical: BRAND.spacing.md,
            borderTopWidth: i ? 1 : 0,
            borderTopColor: THEME.border,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: BRAND.spacing.sm,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: BRAND.spacing.sm,
              }}
            >
              <Feather name={row.icon} color={row.color} size={18} />
              <Text style={{ color: THEME.textSecondary, fontSize: 14 }}>
                {row.label}
              </Text>
            </View>
            <Text
              style={{
                color: row.color,
                fontSize: 20,
                fontWeight: "700",
                fontVariant: ["tabular-nums"],
                flexShrink: 1,
              }}
            >
              {formatCurrency(row.amount, currencyCode)}
            </Text>
          </View>
          <Text
            style={{
              color: THEME.textSecondary,
              fontSize: 12,
              lineHeight: 18,
              marginTop: BRAND.spacing.xs,
            }}
          >
            {row.detail}
          </Text>
        </View>
      ))}
    </DashboardCard>
  );
}
