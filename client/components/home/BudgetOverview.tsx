import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { useTheme } from "@/hooks/useRedux";
import { BRAND } from "@/constants/ThemePalettes";
import { formatCurrency } from "@/utils/helper";
import type { IFinancialReport } from "@/types/financialSummary/types";
import DashboardCard from "./DashboardCard";
import DashboardSection from "./DashboardSection";

/** Displays authoritative category limits, spending and remaining amounts without recomputing totals. */
export default function BudgetOverview({
  report,
  onOpenBudgets,
}: {
  report: IFinancialReport;
  onOpenBudgets: () => void;
}) {
  const { THEME } = useTheme();
  return (
    <DashboardSection
      title="Monthly budgets"
      action="View budgets"
      onPress={onOpenBudgets}
    >
      <DashboardCard padding={BRAND.spacing.md}>
        {report.budgets.length === 0 ? (
          <>
            <Text
              style={{
                color: THEME.textPrimary,
                fontSize: 15,
                fontWeight: "600",
              }}
            >
              Give your month a plan
            </Text>
            <Text
              style={{
                color: THEME.textSecondary,
                fontSize: 14,
                lineHeight: 21,
                marginTop: BRAND.spacing.sm,
              }}
            >
              No budgets for this period. Open Budgets to use Smart Month Setup
              or set your own limits.
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
          report.budgets.slice(0, 3).map((budget, index) => {
            const percent = budget.utilizationPercentage;
            const color =
              budget.remaining < 0
                ? THEME.danger
                : percent != null && percent >= 80
                  ? THEME.warning
                  : THEME.primary;
            return (
              <TouchableOpacity
                key={budget.id}
                onPress={onOpenBudgets}
                accessibilityRole="button"
                accessibilityLabel={`${budget.category}, ${formatCurrency(budget.spent, report.currency)} spent of ${formatCurrency(budget.limit, report.currency)} budgeted, ${formatCurrency(budget.remaining, report.currency)} remaining`}
                style={{
                  paddingTop: index ? BRAND.spacing.md : 0,
                  paddingBottom:
                    index < Math.min(report.budgets.length, 3) - 1
                      ? BRAND.spacing.md
                      : 0,
                  borderTopWidth: index ? 1 : 0,
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
                  <Text
                    style={{
                      color: THEME.textPrimary,
                      fontSize: 15,
                      fontWeight: "600",
                      flexShrink: 1,
                    }}
                  >
                    {budget.category}
                  </Text>
                  <Text style={{ color, fontSize: 12, fontWeight: "600" }}>
                    {budget.limit <= 0
                      ? "No limit set"
                      : budget.remaining < 0
                        ? "Over budget"
                        : `${Math.round(percent ?? 0)}% used`}
                  </Text>
                </View>
                <View
                  accessibilityRole="progressbar"
                  accessibilityValue={{
                    min: 0,
                    max: 100,
                    now: Math.max(0, Math.min(100, percent ?? 0)),
                    text: percent == null ? "No limit set" : `${percent}% used`,
                  }}
                  style={{
                    height: 6,
                    backgroundColor: THEME.surfaceHover,
                    borderRadius: 3,
                    overflow: "hidden",
                    marginVertical: BRAND.spacing.sm,
                  }}
                >
                  <View
                    style={{
                      height: 6,
                      width: `${Math.max(0, Math.min(100, percent ?? 0))}%`,
                      backgroundColor: color,
                      borderRadius: 3,
                    }}
                  />
                </View>
                <Text
                  style={{
                    color: THEME.textSecondary,
                    fontSize: 12,
                    lineHeight: 19,
                  }}
                >
                  {formatCurrency(budget.spent, report.currency)} spent ·{" "}
                  {formatCurrency(budget.limit, report.currency)} budgeted
                </Text>
                <Text style={{ color, fontSize: 12, lineHeight: 19 }}>
                  {formatCurrency(budget.remaining, report.currency)} remaining
                </Text>
              </TouchableOpacity>
            );
          })
        )}
        {report.budgets.length > 3 && (
          <Text
            style={{
              color: THEME.textSecondary,
              fontSize: 12,
              marginTop: BRAND.spacing.md,
            }}
          >
            Showing 3 of {report.budgets.length} categories. View budgets for
            the full month.
          </Text>
        )}
      </DashboardCard>
    </DashboardSection>
  );
}
