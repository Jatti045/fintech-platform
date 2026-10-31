import React, { useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useRedux";
import { BRAND } from "@/constants/ThemePalettes";
import { formatCurrency } from "@/utils/helper";
import { safeAmount } from "@/utils/transaction/helpers";
import type { DisplayBudget, IBudget } from "@/types/budget/types";

export interface UnbudgetedBudgetSectionProps {
  budgets: DisplayBudget[];
  onSetLimit: (budget: IBudget) => void;
  onUseSuggestions?: () => void;
}
export default function UnbudgetedBudgetSection({
  budgets,
  onSetLimit,
  onUseSuggestions,
}: UnbudgetedBudgetSectionProps) {
  const { THEME } = useTheme();
  const [expanded, setExpanded] = useState(true);
  const totalSpent = budgets.reduce(
    (acc, b) => acc + safeAmount(b.displaySpent),
    0,
  );
  const currencyCode = budgets[0]?.displayCurrency || "USD";
  if (!budgets.length) return null;
  return (
    <View style={{ marginVertical: BRAND.spacing.md }}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Unbudgeted spending"
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((v) => !v)}
        style={{
          minHeight: BRAND.touchTarget,
          flexDirection: "row",
          flexWrap: "wrap",
          alignItems: "center",
          gap: BRAND.spacing.sm,
          marginBottom: BRAND.spacing.sm,
        }}
      >
        <Text
          accessibilityRole="header"
          style={{
            color: THEME.textPrimary,
            fontSize: 18,
            fontWeight: "700",
            flexGrow: 1,
          }}
        >
          Unbudgeted spending
        </Text>
        <Text style={{ color: THEME.textSecondary, fontSize: 14 }}>
          {formatCurrency(totalSpent, currencyCode)}
        </Text>
        <Feather
          name={expanded ? "chevron-up" : "chevron-down"}
          size={18}
          color={THEME.textSecondary}
        />
      </TouchableOpacity>
      {expanded && (
        <View
          style={{
            backgroundColor: THEME.surface,
            borderRadius: BRAND.radius.card,
            borderWidth: 1,
            borderColor: THEME.border,
            padding: BRAND.spacing.md,
          }}
        >
          <Text
            style={{ color: THEME.textSecondary, fontSize: 13, lineHeight: 20 }}
          >
            Review imported categories and assign limits to plan this spending.
          </Text>
          {onUseSuggestions && (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Use suggested limits"
              onPress={onUseSuggestions}
              style={{ minHeight: BRAND.touchTarget, justifyContent: "center" }}
            >
              <Text style={{ color: THEME.primary, fontWeight: "600" }}>
                Use suggested limits
              </Text>
            </TouchableOpacity>
          )}
          {budgets.map((budget, index) => (
            <View
              key={budget.id}
              style={{
                paddingVertical: BRAND.spacing.md,
                borderTopWidth: index ? 1 : 0,
                borderTopColor: THEME.border,
                gap: BRAND.spacing.sm,
              }}
            >
              <Text
                style={{
                  color: THEME.textPrimary,
                  fontSize: 15,
                  fontWeight: "600",
                }}
              >
                {budget.category}
              </Text>
              <Text
                style={{
                  color: THEME.textSecondary,
                  fontSize: 13,
                  lineHeight: 20,
                }}
              >
                Spent{" "}
                {formatCurrency(budget.displaySpent, budget.displayCurrency)}
                {budget.displayLimit > 0
                  ? ` of ${formatCurrency(budget.displayLimit, budget.displayCurrency)}`
                  : " — no limit"}
              </Text>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={`Set limit for ${budget.category}`}
                onPress={() => onSetLimit(budget)}
                style={{
                  minHeight: BRAND.touchTarget,
                  borderRadius: BRAND.radius.input,
                  borderWidth: 1,
                  borderColor: THEME.border,
                  backgroundColor: THEME.subtleSurface,
                  paddingHorizontal: BRAND.spacing.md,
                  alignSelf: "flex-start",
                  justifyContent: "center",
                }}
              >
                <Text
                  style={{
                    color: THEME.textPrimary,
                    fontWeight: "600",
                    fontSize: 13,
                  }}
                >
                  Set Limit
                </Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
