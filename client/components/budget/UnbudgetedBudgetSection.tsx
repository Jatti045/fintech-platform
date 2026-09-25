import React, { useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useRedux";
import { formatCurrency } from "@/utils/helper";
import { hexToRgba } from "@/utils/colorUtils";
import { safeAmount } from "@/utils/transaction/helpers";
import type { DisplayBudget, IBudget } from "@/types/budget/types";

export interface UnbudgetedBudgetSectionProps {
  budgets: DisplayBudget[];
  /** Invoked by the "Set Limit" action, opening the edit modal for a budget. */
  onSetLimit: (budget: IBudget) => void;
  /** Optional: surfaces a "Use suggested limits" shortcut into Smart Month Setup. */
  onUseSuggestions?: () => void;
}

/**
 * Lightweight Unbudgeted Spending section matching Section 13 of the reference mockup:
 * ― UNBUDGETED SPENDING                     $170.04 >
 * Transactions that aren't in a budget yet
 */
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

  if (budgets.length === 0) return null;

  return (
    <View style={{ marginTop: 18, marginBottom: 12 }}>
      {/* ── Section Header ──────────────────────────────────────────────── */}
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => setExpanded((prev) => !prev)}
        style={{ marginBottom: 4 }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View
              style={{
                width: 18,
                height: 3,
                borderRadius: 1.5,
                backgroundColor: THEME.primary,
                marginRight: 8,
              }}
            />
            <Text
              style={{
                color: THEME.textPrimary,
                fontSize: 13.5,
                fontWeight: "700",
                letterSpacing: 0.5,
                textTransform: "uppercase",
              }}
            >
              UNBUDGETED SPENDING
            </Text>
          </View>

          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Text
              style={{
                color: THEME.textSecondary,
                fontSize: 13,
                fontWeight: "600",
                marginRight: 4,
              }}
            >
              {formatCurrency(totalSpent, currencyCode)}
            </Text>
            <Feather
              name={expanded ? "chevron-down" : "chevron-right"}
              size={14}
              color={THEME.textSecondary}
            />
          </View>
        </View>

        <Text
          style={{
            color: THEME.textSecondary,
            fontSize: 12.5,
            marginTop: 2,
            marginLeft: 26,
          }}
        >
          Transactions that aren&apos;t in a budget yet
        </Text>
      </TouchableOpacity>

      {/* ── Unbudgeted Items List ───────────────────────────────────────── */}
      {expanded && (
        <View
          style={{
            backgroundColor: THEME.surface,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: THEME.border,
            padding: 12,
            marginTop: 8,
          }}
        >
          {onUseSuggestions ? (
            <TouchableOpacity
              onPress={onUseSuggestions}
              activeOpacity={0.8}
              accessibilityRole="button"
              style={{
                backgroundColor: hexToRgba(THEME.primary, 0.12),
                borderColor: THEME.primary,
                borderWidth: 1,
                borderRadius: 10,
                paddingVertical: 9,
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <Text
                style={{
                  color: THEME.primary,
                  fontSize: 12.5,
                  fontWeight: "700",
                }}
              >
                Use suggested limits
              </Text>
            </TouchableOpacity>
          ) : null}

          {budgets.map((budget, index) => (
            <View
              key={budget.id}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingVertical: 10,
                borderTopWidth: index === 0 ? 0 : 1,
                borderTopColor: THEME.border,
              }}
            >
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text
                  style={{
                    color: THEME.textPrimary,
                    fontSize: 13.5,
                    fontWeight: "600",
                  }}
                  numberOfLines={1}
                >
                  {budget.category}
                </Text>
                <Text
                  style={{
                    color: THEME.textSecondary,
                    fontSize: 12,
                    marginTop: 2,
                  }}
                >
                  Spent{" "}
                  {formatCurrency(budget.displaySpent, budget.displayCurrency)}
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
                  backgroundColor: hexToRgba(THEME.primary, 0.14),
                  borderColor: hexToRgba(THEME.primary, 0.4),
                  borderWidth: 1,
                  borderRadius: 8,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                }}
              >
                <Text
                  style={{
                    color: THEME.primary,
                    fontSize: 12,
                    fontWeight: "700",
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
