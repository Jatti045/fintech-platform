import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useRedux";
import { BRAND } from "@/constants/ThemePalettes";
import { capitalizeFirst, formatCurrency } from "@/utils/helper";
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
  remaining?: number;
  utilizationPercentage?: number | null;
  expanded: boolean;
  isLast?: boolean;
  onToggle: (budget: IBudget) => void;
  onEdit: (budget: IBudget) => void;
  onDelete: (id: string) => void;
}
const BudgetReservoirRow = React.memo(function BudgetReservoirRow({
  budget,
  displayLimit,
  displaySpent,
  currencyCode = "USD",
  remaining,
  utilizationPercentage,
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
  const percent = Math.round(utilizationPercentage ?? ratio * 100);
  const statusColor =
    ratio > 1 ? THEME.danger : ratio >= 0.8 ? THEME.warning : THEME.primary;
  const status =
    limit <= 0
      ? "No limit configured"
      : ratio > 1
        ? "Over budget"
        : ratio >= 0.8
          ? "Near limit"
          : "On track";
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
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          accessibilityLabel={`${capitalizeFirst(budget.category)} budget, ${limit > 0 ? `${percent}% used` : "no limit configured"}, ${status}`}
          onPress={() => {
            hapticLight();
            onToggle(budget);
          }}
          style={{ padding: BRAND.spacing.md }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: BRAND.spacing.sm,
            }}
          >
            <BudgetCategoryIcon category={budget.category} size={38} />
            <Text
              style={{
                color: THEME.textPrimary,
                fontSize: 16,
                fontWeight: "600",
                flex: 1,
              }}
              numberOfLines={2}
            >
              {capitalizeFirst(budget.category)}
            </Text>
            <Feather
              name={expanded ? "chevron-up" : "chevron-down"}
              size={18}
              color={THEME.textSecondary}
            />
          </View>
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              justifyContent: "space-between",
              gap: BRAND.spacing.sm,
              marginTop: BRAND.spacing.md,
            }}
          >
            <Text
              style={{
                color: THEME.textPrimary,
                fontSize: 18,
                fontWeight: "700",
                fontVariant: ["tabular-nums"],
                flexShrink: 1,
              }}
            >
              {formatCurrency(spent, currencyCode)} spent
            </Text>
            <Text
              style={{ color: statusColor, fontSize: 12, fontWeight: "600" }}
            >
              {status}
              {limit > 0 ? ` · ${percent}%` : ""}
            </Text>
          </View>
          {limit > 0 && (
            <View
              accessibilityRole="progressbar"
              accessibilityLabel={`${budget.category} spending progress`}
              accessibilityValue={{
                min: 0,
                max: 100,
                now: Math.max(0, Math.min(100, percent)),
                text: `${percent}% used, ${status}`,
              }}
              style={{
                height: 6,
                borderRadius: 3,
                backgroundColor: THEME.surfaceHover,
                overflow: "hidden",
                marginVertical: BRAND.spacing.sm,
              }}
            >
              <View
                style={{
                  height: 6,
                  width: `${Math.max(0, Math.min(100, percent))}%`,
                  backgroundColor: statusColor,
                  borderRadius: 3,
                }}
              />
            </View>
          )}
          <Text
            style={{
              color: THEME.textSecondary,
              fontSize: 12,
              lineHeight: 19,
              marginTop: limit > 0 ? 0 : BRAND.spacing.sm,
            }}
          >
            {formatCurrency(limit, currencyCode)} budgeted
          </Text>
          <Text
            style={{
              color:
                remaining != null && remaining < 0
                  ? THEME.danger
                  : THEME.textSecondary,
              fontSize: 13,
              lineHeight: 20,
            }}
          >
            {remaining != null
              ? `${formatCurrency(remaining, currencyCode)} remaining`
              : limit > 0
                ? `${formatCurrency(limit - spent, currencyCode)} remaining`
                : "Set a limit to track remaining funds"}
          </Text>
        </TouchableOpacity>
        {expanded && (
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: BRAND.spacing.sm,
              paddingHorizontal: BRAND.spacing.md,
              paddingBottom: BRAND.spacing.md,
            }}
          >
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Edit"
              onPress={() => onEdit(budget)}
              style={{
                flexGrow: 1,
                flexBasis: 100,
                minHeight: BRAND.touchTarget,
                borderRadius: BRAND.radius.input,
                borderWidth: 1,
                borderColor: THEME.border,
                backgroundColor: THEME.subtleSurface,
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "row",
                gap: BRAND.spacing.sm,
              }}
            >
              <Feather name="edit-3" size={16} color={THEME.primary} />
              <Text style={{ color: THEME.textPrimary, fontWeight: "600" }}>
                Edit
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Delete"
              onPress={() => onDelete(budget.id)}
              style={{
                flexGrow: 1,
                flexBasis: 100,
                minHeight: BRAND.touchTarget,
                borderRadius: BRAND.radius.input,
                borderWidth: 1,
                borderColor: THEME.border,
                backgroundColor: THEME.errorSurface,
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "row",
                gap: BRAND.spacing.sm,
              }}
            >
              <Feather name="trash-2" size={16} color={THEME.danger} />
              <Text style={{ color: THEME.danger, fontWeight: "600" }}>
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
