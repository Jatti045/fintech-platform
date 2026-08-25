import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { useTheme } from "@/hooks/useRedux";
import SectionHeader from "@/components/global/SectionHeader";
import GlassPanel from "@/components/global/GlassPanel";
import { formatCurrency, hexToRgba } from "@/utils/helper";
import type { DisplayBudget, IBudget } from "@/types/budget/types";

export interface UnbudgetedBudgetSectionProps {
  budgets: DisplayBudget[];
  /** Invoked by the "Set Limit" action, opening the edit modal for a budget. */
  onSetLimit: (budget: IBudget) => void;
  /** Optional: surfaces a "Use suggested limits" shortcut into Smart Month Setup. */
  onUseSuggestions?: () => void;
}

/**
 * Lists auto-created / unbudgeted categories (from the bank feed with no
 * limit assigned) with a "Set Limit" action. Pure presentation — classification
 * happens in `useBudgetScreen`.
 */
export default function UnbudgetedBudgetSection({
  budgets,
  onSetLimit,
  onUseSuggestions,
}: UnbudgetedBudgetSectionProps) {
  const { THEME } = useTheme();

  return (
    <>
      <SectionHeader
        title="Unbudgeted Spending"
        subtitle="Set Limits"
        accent={THEME.warning}
      />
      <GlassPanel padding={12} radius={18} style={{ marginBottom: 12 }}>
        {onUseSuggestions ? (
          <TouchableOpacity
            onPress={onUseSuggestions}
            activeOpacity={0.8}
            accessibilityRole="button"
            style={{
              backgroundColor: hexToRgba(THEME.primary, 0.12),
              borderRadius: 8,
              paddingHorizontal: 12,
              paddingVertical: 9,
              alignItems: "center",
              marginBottom: 4,
            }}
          >
            <Text style={{ color: THEME.primary, fontSize: 12, fontWeight: "800" }}>
              Use suggested limits
            </Text>
          </TouchableOpacity>
        ) : (
          <Text
            style={{
              color: THEME.textSecondary,
              fontSize: 12,
              lineHeight: 17,
              marginBottom: 8,
            }}
          >
            These categories came from your bank feed with no limit set. Tap
            “Set Limit” to assign one and clear the flag.
          </Text>
        )}
        {budgets.map((budget) => (
          <View
            key={budget.id}
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingVertical: 8,
              borderTopWidth: 1,
              borderTopColor: hexToRgba(THEME.border, 0.6),
            }}
          >
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: THEME.textPrimary,
                  fontSize: 13,
                  fontWeight: "700",
                }}
                numberOfLines={1}
              >
                {budget.category}
              </Text>
              <Text
                style={{
                  color: THEME.textSecondary,
                  fontSize: 11,
                  marginTop: 1,
                }}
              >
                Spent {formatCurrency(budget.displaySpent, budget.displayCurrency)}
                {budget.displayLimit > 0
                  ? ` of ${formatCurrency(budget.displayLimit, budget.displayCurrency)}`
                  : " — no limit"}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => onSetLimit(budget)}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={`Set limit for ${budget.category}`}
              style={{
                backgroundColor: hexToRgba(THEME.warning, 0.16),
                borderRadius: 8,
                paddingHorizontal: 12,
                paddingVertical: 7,
                marginLeft: 8,
              }}
            >
              <Text
                style={{
                  color: THEME.warning,
                  fontSize: 12,
                  fontWeight: "800",
                }}
              >
                Set Limit
              </Text>
            </TouchableOpacity>
          </View>
        ))}
      </GlassPanel>
    </>
  );
}
