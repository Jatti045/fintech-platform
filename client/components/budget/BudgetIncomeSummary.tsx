import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { useTheme } from "@/hooks/useRedux";
import { BRAND } from "@/constants/ThemePalettes";
import { formatCurrency } from "@/utils/helper";

export interface BudgetIncomeSummaryProps {
  income: number;
  totalSpent: number;
  totalLimit?: number;
  currencyCode?: string;
  onPressLimit?: () => void;
}
export default function BudgetIncomeSummary({
  income,
  totalSpent,
  totalLimit = 0,
  currencyCode = "USD",
  onPressLimit,
}: BudgetIncomeSummaryProps) {
  const { THEME } = useTheme();
  const displayIncome = Math.max(0, income);
  const remaining = displayIncome - totalSpent;
  const ratio = displayIncome > 0 ? Math.min(1, totalSpent / displayIncome) : 0;
  const percent = Math.round(ratio * 100);
  return (
    <View
      style={{
        backgroundColor: THEME.surface,
        borderRadius: BRAND.radius.card,
        borderWidth: 1,
        borderColor: THEME.border,
        padding: BRAND.spacing.md,
        marginBottom: BRAND.spacing.lg,
      }}
    >
      <Text
        accessibilityRole="header"
        style={{ color: THEME.textPrimary, fontSize: 15, fontWeight: "700" }}
      >
        Income context
      </Text>
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: BRAND.spacing.md,
          marginTop: BRAND.spacing.md,
        }}
      >
        {[
          { label: "Monthly income basis", amount: displayIncome },
          { label: "Income remaining", amount: remaining },
        ].map((item) => (
          <View key={item.label} style={{ flexGrow: 1, flexBasis: 120 }}>
            <Text style={{ color: THEME.textSecondary, fontSize: 12 }}>
              {item.label}
            </Text>
            <Text
              style={{
                color: item.amount < 0 ? THEME.danger : THEME.textPrimary,
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
      <View
        accessibilityRole="progressbar"
        accessibilityLabel="Spending relative to income"
        accessibilityValue={{
          min: 0,
          max: 100,
          now: Math.max(0, Math.min(100, percent)),
          text:
            displayIncome > 0
              ? `${percent}% of income spent`
              : "No income basis",
        }}
        style={{
          height: 6,
          backgroundColor: THEME.surfaceHover,
          borderRadius: 3,
          overflow: "hidden",
          marginVertical: BRAND.spacing.md,
        }}
      >
        <View
          style={{
            height: 6,
            width: `${Math.max(0, Math.min(100, percent))}%`,
            backgroundColor: remaining < 0 ? THEME.danger : THEME.primary,
          }}
        />
      </View>
      <Text
        style={{ color: THEME.textSecondary, fontSize: 12, lineHeight: 19 }}
      >
        {formatCurrency(totalSpent, currencyCode)} spent ·{" "}
        {totalLimit > 0
          ? `Limit: ${formatCurrency(totalLimit, currencyCode)}`
          : "No limit set"}
      </Text>
      {onPressLimit && (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Review month setup"
          onPress={onPressLimit}
          style={{ minHeight: BRAND.touchTarget, justifyContent: "center" }}
        >
          <Text
            style={{ color: THEME.primary, fontSize: 13, fontWeight: "600" }}
          >
            Review month setup
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
