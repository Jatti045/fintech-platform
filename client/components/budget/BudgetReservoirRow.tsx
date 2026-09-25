import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useRedux";
import { capitalizeFirst, formatCurrency } from "@/utils/helper";
import { hexToRgba } from "@/utils/colorUtils";
import { safeAmount } from "@/utils/transaction/helpers";
import type { IBudget } from "@/types/budget/types";
import { hapticLight } from "@/utils/haptics";
import SwipeableRow from "@/components/global/SwipeableRow";
import BudgetCategoryIcon from "./BudgetCategoryIcon";

export interface BudgetReservoirRowProps {
  budget: IBudget;
  displayLimit?: number;
  displaySpent?: number;
  currencyCode?: string;
  expanded: boolean;
  isLast?: boolean;
  onToggle: (budget: IBudget) => void;
  onEdit: (budget: IBudget) => void;
  onDelete: (id: string) => void;
}

/**
 * BudgetReservoirRow — redesigned as an elegant list row matching the mockup:
 * - Category icon with tinted background
 * - Category name (bold white) + $X of $Y spent
 * - Progress bar with semantic status color (green / gold / red)
 * - Right aligned: Spent amount, percentage, subtle chevron
 * - Hairline divider between rows
 * - Drawer with Edit/Delete actions for full backward-compatibility and tests
 */
const BudgetReservoirRow = React.memo(function BudgetReservoirRow({
  budget,
  displayLimit,
  displaySpent,
  currencyCode = "USD",
  expanded,
  isLast = false,
  onToggle,
  onEdit,
  onDelete,
}: BudgetReservoirRowProps) {
  const { THEME } = useTheme();
  const limit = safeAmount(displayLimit ?? budget.limit);
  const spent = safeAmount(displaySpent ?? budget.spent);
  const ratio = limit > 0 ? spent / limit : 0;
  const percent = Math.min(999, Math.round(ratio * 100));

  // Semantic color: green (<= 80%), gold (81-100%), red (> 100%)
  const statusColor =
    ratio > 1 ? THEME.danger : ratio >= 0.8 ? THEME.warning : THEME.success;

  return (
    <SwipeableRow
      onDelete={() => onDelete(budget.id)}
      dangerColor={THEME.danger}
      actionStyle={{ borderRadius: 0 }}
    >
      <View
        style={{
          backgroundColor: THEME.surface,
          borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth,
          borderBottomColor: THEME.border,
        }}
      >
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => {
            hapticLight();
            onToggle(budget);
          }}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          accessibilityLabel={`${capitalizeFirst(budget.category)} budget, ${percent}% used`}
          style={{
            paddingHorizontal: 16,
            paddingVertical: 14,
          }}
        >
          {/* ── Main Category Row ────────────────────────────────────────── */}
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            {/* Category Icon */}
            <View style={{ marginRight: 12 }}>
              <BudgetCategoryIcon category={budget.category} size={38} />
            </View>

            {/* Category Name & Spend Subtitle */}
            <View style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
              <Text
                style={{
                  color: THEME.textPrimary,
                  fontSize: 14.5,
                  fontWeight: "600",
                  letterSpacing: -0.1,
                }}
                numberOfLines={1}
              >
                {capitalizeFirst(budget.category)}
              </Text>
              <Text
                style={{
                  color: THEME.textSecondary,
                  fontSize: 12.5,
                  marginTop: 2,
                }}
                numberOfLines={1}
              >
                {limit > 0
                  ? `${formatCurrency(spent, currencyCode)} of ${formatCurrency(limit, currencyCode)}`
                  : `Spent ${formatCurrency(spent, currencyCode)} — no limit`}
              </Text>
            </View>

            {/* Spent Amount & Percentage + Chevron */}
            <View style={{ alignItems: "flex-end" }}>
              <Text
                style={{
                  color: ratio >= 0.8 ? statusColor : THEME.textPrimary,
                  fontSize: 14,
                  fontWeight: "700",
                }}
              >
                {formatCurrency(spent, currencyCode)}
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  marginTop: 2,
                }}
              >
                <Text
                  style={{
                    color: ratio >= 0.8 ? statusColor : THEME.textSecondary,
                    fontSize: 12,
                    fontWeight: "600",
                    marginRight: 4,
                  }}
                >
                  {percent}%
                </Text>
                <Feather
                  name="chevron-right"
                  size={14}
                  color={THEME.textSecondary}
                />
              </View>
            </View>
          </View>

          {/* ── Progress Bar ────────────────────────────────────────────── */}
          {limit > 0 && (
            <View
              style={{
                height: 5,
                backgroundColor: THEME.surfaceHover,
                borderRadius: 2.5,
                marginTop: 10,
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  height: "100%",
                  width: `${Math.min(100, percent)}%`,
                  backgroundColor: statusColor,
                  borderRadius: 2.5,
                }}
              />
            </View>
          )}
        </TouchableOpacity>

        {/* ── Expandable Action Drawer (when row is tapped) ─────────────── */}
        {expanded && (
          <View
            style={{
              paddingHorizontal: 16,
              paddingBottom: 14,
              paddingTop: 4,
              flexDirection: "row",
              gap: 10,
            }}
          >
            <TouchableOpacity
              onPress={() => onEdit(budget)}
              accessibilityRole="button"
              accessibilityLabel="Edit"
              style={{
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: THEME.surfaceHover,
                borderWidth: 1,
                borderColor: THEME.border,
                borderRadius: 10,
                paddingVertical: 9,
              }}
            >
              <Feather
                name="edit-3"
                size={14}
                color={THEME.textPrimary}
                style={{ marginRight: 6 }}
              />
              <Text
                style={{
                  color: THEME.textPrimary,
                  fontSize: 13,
                  fontWeight: "600",
                }}
              >
                Edit
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => onDelete(budget.id)}
              accessibilityRole="button"
              accessibilityLabel="Delete"
              style={{
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: hexToRgba(THEME.danger, 0.12),
                borderWidth: 1,
                borderColor: hexToRgba(THEME.danger, 0.3),
                borderRadius: 10,
                paddingVertical: 9,
              }}
            >
              <Feather
                name="trash-2"
                size={14}
                color={THEME.danger}
                style={{ marginRight: 6 }}
              />
              <Text
                style={{
                  color: THEME.danger,
                  fontSize: 13,
                  fontWeight: "600",
                }}
              >
                Delete
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SwipeableRow>
  );
});

export default BudgetReservoirRow;
