import React from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import { useTheme } from "@/hooks/useRedux";
import { capitalizeFirst, formatCurrency } from "@/utils/helper";
import type { DisplayBudget } from "@/types/budget/types";
import DashboardCard from "./DashboardCard";

type Props = {
  budgets: DisplayBudget[];
  currencyCode: string;
  loading: boolean;
  error: boolean;
  onRetry: () => unknown;
};

export default function BudgetOverview({
  budgets,
  currencyCode,
  loading,
  error,
  onRetry,
}: Props) {
  const { THEME } = useTheme();
  return (
    <DashboardCard padding={16} style={{ marginBottom: 14 }}>
      <Text
        accessibilityRole="header"
        style={{
          color: THEME.textPrimary,
          fontSize: 18,
          fontWeight: "700",
          marginBottom: 14,
        }}
      >
        Budget overview
      </Text>
      {loading && budgets.length === 0 ? (
        <ActivityIndicator color={THEME.primary} />
      ) : null}
      {error ? (
        <View>
          <Text style={{ color: THEME.textSecondary }}>
            Could not refresh budgets.
          </Text>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={onRetry}
            style={{ paddingVertical: 10 }}
          >
            <Text style={{ color: THEME.primary }}>Retry budgets</Text>
          </TouchableOpacity>
        </View>
      ) : null}
      {!loading && !error && budgets.length === 0 ? (
        <Text style={{ color: THEME.textSecondary }}>
          No budgets for this month. Add one in the Budgets tab.
        </Text>
      ) : null}
      {budgets.map((budget, index) => {
        const spent = budget.displaySpent;
        const limit = budget.displayLimit;
        const remaining = limit - spent;
        const color = remaining < 0 ? THEME.danger : THEME.primary;
        const progress =
          limit > 0
            ? Math.max(0, Math.min(1, spent / limit))
            : spent > 0
              ? 1
              : 0;
        return (
          <View key={budget.id} style={{ marginTop: index === 0 ? 0 : 16 }}>
            <Text
              style={{
                color: THEME.textPrimary,
                fontSize: 14,
                fontWeight: "600",
                marginBottom: 5,
              }}
            >
              {capitalizeFirst(budget.category)}
            </Text>
            <Text
              style={{
                color: THEME.textSecondary,
                fontSize: 12,
                marginBottom: 8,
              }}
            >
              {formatCurrency(spent, currencyCode)} spent ·{" "}
              {formatCurrency(limit, currencyCode)} budget
            </Text>
            <View
              style={{
                height: 6,
                backgroundColor: THEME.border,
                borderRadius: 3,
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  height: 6,
                  width: `${progress * 100}%`,
                  backgroundColor: color,
                  borderRadius: 3,
                }}
              />
            </View>
            <Text
              style={{
                color: remaining < 0 ? THEME.danger : THEME.textSecondary,
                fontSize: 12,
                marginTop: 6,
              }}
            >
              {formatCurrency(Math.abs(remaining), currencyCode)}{" "}
              {remaining < 0 ? "over budget" : "left"}
            </Text>
          </View>
        );
      })}
    </DashboardCard>
  );
}
