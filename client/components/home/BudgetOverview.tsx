import DisclosureChevron from "@/components/global/DisclosureChevron";
import React, { useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { useTheme } from "@/hooks/useRedux";
import { BRAND, TYPE } from "@/constants/ThemePalettes";
import { formatCurrency } from "@/utils/helper";
import type { IFinancialReport } from "@/types/financialSummary/types";
import ProgressTrack from "@/components/global/ProgressTrack";
import BudgetCategoryDetails from "./BudgetCategoryDetails";

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
    <View
      style={{
        marginBottom: BRAND.spacing.lg,
        gap: BRAND.spacing.sm,
        padding: BRAND.spacing.md,
        borderRadius: BRAND.radius.card,
        backgroundColor: THEME.surface,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: BRAND.spacing.sm,
        }}
      >
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
              style={[TYPE.section, { color: THEME.textPrimary }]}
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
                : "No limits set for this month"}
            </Text>
          </View>
          {percent != null && (
            <Text style={{ color, fontSize: 20, fontWeight: "700" }}>
              {percent}%
            </Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Budget category details"
          accessibilityHint={
            expanded
              ? "Hides the category breakdown"
              : "Shows the category breakdown"
          }
          accessibilityState={{ expanded }}
          aria-expanded={expanded}
          onPress={() => setExpanded((visible) => !visible)}
          style={{
            width: 48,
            borderRadius: 16,
            backgroundColor: THEME.subtleSurface,
            minHeight: 48,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <DisclosureChevron expanded={expanded} color={THEME.primary} />
        </TouchableOpacity>
      </View>
      {report.budgets.length > 0 && (
        <ProgressTrack
          percent={percent ?? 0}
          description={
            percent == null
              ? "No limit set"
              : `${percent}% of monthly budget spent`
          }
          color={color}
        />
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
          <View style={{ marginTop: BRAND.spacing.md }}>
            <BudgetCategoryDetails
              report={report}
              onOpenBudgets={onOpenBudgets}
            />
          </View>
        )
      )}
    </View>
  );
}
