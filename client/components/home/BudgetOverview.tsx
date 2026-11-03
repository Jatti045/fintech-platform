import React, { useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { useTheme } from "@/hooks/useRedux";
import { BRAND } from "@/constants/ThemePalettes";
import { formatCurrency } from "@/utils/helper";
import type { IFinancialReport } from "@/types/financialSummary/types";
import DashboardCard from "./DashboardCard";
import BudgetCategoryDetails from "./BudgetCategoryDetails";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

/** Displays authoritative category limits, spending and remaining amounts without recomputing totals. */
export default function BudgetOverview({
  report,
  onOpenBudgets,
}: {
  report: IFinancialReport;
  onOpenBudgets: () => void;
}) {
  const { THEME } = useTheme();
  const [expanded, setExpanded] = useState(false);
  // Sum server-normalized category amounts; do not substitute all spending
  // (which can include categories without a budget) for budget utilization.
  const totals = report.budgets.reduce(
    (sum, budget) => ({
      spent: sum.spent + budget.spent,
      limit: sum.limit + budget.limit,
    }),
    { spent: 0, limit: 0 },
  );
  const percent =
    totals.limit > 0 ? Math.round((totals.spent / totals.limit) * 100) : null;
  const color = totals.spent > totals.limit ? THEME.danger : THEME.primary;
  return (
    <DashboardCard padding={14} style={{ marginBottom: 14 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Budget category details"
          accessibilityHint="Show spending and remaining amounts for each budget category"
          accessibilityState={{ expanded }}
          onPress={() => setExpanded(!expanded)}
          style={{
            width: 48,
            minHeight: 48,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: THEME.subtleSurface,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Feather name="star" size={23} color={THEME.primary} />
          </View>
          <Feather
            name={expanded ? "chevron-up" : "chevron-down"}
            size={10}
            color={THEME.primary}
            style={{ position: "absolute", right: 0, bottom: 3 }}
          />
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="View budgets"
          onPress={onOpenBudgets}
          style={{
            flex: 1,
            minHeight: 48,
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text
              accessibilityRole="header"
              style={{
                color: THEME.textPrimary,
                fontSize: 16,
                fontWeight: "700",
                letterSpacing: -0.3,
              }}
            >
              Monthly Budget
            </Text>
            <Text
              style={{
                color: THEME.textSecondary,
                fontSize: 12,
                lineHeight: 18,
                marginTop: 3,
              }}
            >
              {report.budgets.length
                ? `${formatCurrency(totals.spent, report.currency)} of ${formatCurrency(totals.limit, report.currency)} spent`
                : "Give your month a plan"}
            </Text>
          </View>
          {percent != null && (
            <Text style={{ color, fontSize: 20, fontWeight: "700" }}>
              {percent}%
            </Text>
          )}
        </TouchableOpacity>
      </View>
      {report.budgets.length > 0 && (
        <View
          accessibilityRole="progressbar"
          accessibilityValue={{
            min: 0,
            max: 100,
            now: Math.max(0, Math.min(100, percent ?? 0)),
            text:
              percent == null
                ? "No limit set"
                : `${percent}% of monthly budget spent`,
          }}
          style={{
            height: 11,
            borderRadius: 6,
            backgroundColor: THEME.border,
            overflow: "hidden",
            marginTop: 9,
          }}
        >
          <LinearGradient
            colors={[
              color,
              totals.spent > totals.limit ? THEME.danger : THEME.primaryHover,
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{
              height: 11,
              borderRadius: 6,
              width: `${Math.max(0, Math.min(100, percent ?? 0))}%`,
            }}
          />
        </View>
      )}
      {report.budgets.length === 0 ? (
        <>
          <Text
            style={{
              color: THEME.textSecondary,
              fontSize: 14,
              lineHeight: 21,
              marginTop: BRAND.spacing.sm,
            }}
          >
            No budgets for this period. Open Budgets to use Smart Month Setup or
            set your own limits.
          </Text>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Set up your month"
            onPress={onOpenBudgets}
            style={{
              minHeight: BRAND.touchTarget,
              justifyContent: "center",
              alignSelf: "flex-start",
            }}
          >
            <Text style={{ color: THEME.primary, fontWeight: "700" }}>
              Set up your month
            </Text>
          </TouchableOpacity>
        </>
      ) : (
        expanded && (
          <BudgetCategoryDetails
            report={report}
            onOpenBudgets={onOpenBudgets}
          />
        )
      )}
    </DashboardCard>
  );
}
