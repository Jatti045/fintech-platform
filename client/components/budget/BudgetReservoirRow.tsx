import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useRedux";
import { BRAND } from "@/constants/ThemePalettes";
import DashboardCard from "@/components/home/DashboardCard";
import { capitalizeFirst, formatCurrency, hexToRgba } from "@/utils/helper";
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
  onToggle,
  onEdit,
  onDelete,
}: BudgetReservoirRowProps) {
  const { THEME } = useTheme();
  const limit = safeAmount(displayLimit ?? budget.limit);
  const spent = safeAmount(displaySpent ?? budget.spent);
  const remainingAmount = remaining ?? (limit > 0 ? limit - spent : null);
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
    <View style={{ marginBottom: 12 }}>
      <SwipeableRow
        onDelete={() => onDelete(budget.id)}
        dangerColor={THEME.danger}
        actionStyle={{ borderRadius: 18, marginBottom: 0 }}
      >
        <DashboardCard
          style={{
            backgroundColor: ratio > 1 ? THEME.errorSurface : THEME.surface,
            borderColor:
              ratio > 1
                ? hexToRgba(THEME.danger, 0.18)
                : hexToRgba(THEME.border, 0.25),
          }}
        >
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityState={{ expanded }}
            accessibilityHint="Show budget actions"
            accessibilityValue={{
              text: `Allocated ${formatCurrency(limit, currencyCode)}, spent ${formatCurrency(spent, currencyCode)}, ${remainingAmount == null ? "set a limit to track remaining funds" : `${formatCurrency(remainingAmount, currencyCode)} remaining`}`,
            }}
            accessibilityLabel={`${capitalizeFirst(budget.category)} budget, ${limit > 0 ? `${percent}% used` : "no limit configured"}, ${status}`}
            onPress={() => {
              hapticLight();
              onToggle(budget);
            }}
            style={{ padding: 12 }}
          >
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
            >
              <BudgetCategoryIcon category={budget.category} size={42} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
                >
                  <Text
                    style={{
                      color: THEME.textPrimary,
                      fontSize: 16,
                      lineHeight: 20,
                      fontWeight: "700",
                      letterSpacing: -0.3,
                      flex: 1,
                    }}
                    numberOfLines={2}
                  >
                    {capitalizeFirst(budget.category)}
                  </Text>
                  <View
                    style={{
                      backgroundColor: hexToRgba(statusColor, 0.1),
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      borderRadius: 20,
                    }}
                  >
                    <Text
                      style={{
                        color: statusColor,
                        fontSize: 13,
                        fontWeight: "700",
                      }}
                    >
                      {limit > 0 ? `${percent}%` : "No limit"}
                    </Text>
                  </View>
                  <Feather
                    name={expanded ? "chevron-up" : "chevron-right"}
                    size={18}
                    color={THEME.textSecondary}
                  />
                </View>
                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    alignItems: "center",
                    gap: 5,
                    marginTop: 4,
                  }}
                >
                  {[
                    { label: "Allocated", amount: limit },
                    { label: "Spent", amount: spent },
                    {
                      label: "Remaining",
                      amount: remainingAmount,
                    },
                  ].map((item) => (
                    <Text
                      key={item.label}
                      style={{
                        color: THEME.textSecondary,
                        fontSize: 10,
                        lineHeight: 14,
                      }}
                    >
                      {item.label}{" "}
                      <Text
                        style={{
                          color:
                            item.amount != null && item.amount < 0
                              ? THEME.danger
                              : THEME.textPrimary,
                          fontWeight: "600",
                        }}
                      >
                        {item.amount == null
                          ? "—"
                          : formatCurrency(item.amount, currencyCode)}
                      </Text>
                    </Text>
                  ))}
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
                      height: 8,
                      borderRadius: 5,
                      backgroundColor: THEME.border,
                      overflow: "hidden",
                      marginTop: 7,
                    }}
                  >
                    <View
                      style={{
                        height: 8,
                        width: `${Math.max(0, Math.min(100, percent))}%`,
                        backgroundColor: statusColor,
                        borderRadius: 5,
                      }}
                    />
                  </View>
                )}
                {expanded && (
                  <Text
                    style={{ color: statusColor, fontSize: 10, marginTop: 5 }}
                  >
                    {status}
                  </Text>
                )}
              </View>
            </View>
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
        </DashboardCard>
      </SwipeableRow>
    </View>
  );
});
export default BudgetReservoirRow;
