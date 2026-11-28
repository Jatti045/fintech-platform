import DisclosureChevron from "@/components/global/DisclosureChevron";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useRedux";
import { BRAND, TYPE } from "@/constants/ThemePalettes";
import ProgressTrack from "@/components/global/ProgressTrack";
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
  const spentLabel = formatCurrency(spent, currencyCode);
  const limitLabel = formatCurrency(limit, currencyCode);
  const remainingLabel =
    remainingAmount == null
      ? null
      : formatCurrency(remainingAmount, currencyCode);

  return (
    <View
      style={{
        borderTopWidth: StyleSheet.hairlineWidth,
        borderColor: THEME.border,
      }}
    >
      <SwipeableRow
        onDelete={() => onDelete(budget.id)}
        dangerColor={THEME.danger}
        actionStyle={{ borderRadius: BRAND.radius.button, marginBottom: 0 }}
      >
        <View
          style={{
            backgroundColor: THEME.surface,
          }}
        >
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityState={{ expanded }}
            aria-expanded={expanded}
            accessibilityHint="Show budget actions"
            accessibilityValue={{
              text: `Allocated ${limitLabel}, spent ${spentLabel}, ${remainingLabel == null ? "set a limit to track remaining funds" : `${remainingLabel} remaining`}`,
            }}
            accessibilityLabel={`${capitalizeFirst(budget.category)} budget, ${limit > 0 ? `${percent}% used` : "no limit configured"}, ${status}`}
            onPress={() => {
              hapticLight();
              onToggle(budget);
            }}
            activeOpacity={0.75}
            style={styles.row}
          >
            <View style={styles.heading}>
              <BudgetCategoryIcon category={budget.category} size={32} />
              <Text
                style={[TYPE.label, styles.title, { color: THEME.textPrimary }]}
                numberOfLines={2}
              >
                {capitalizeFirst(budget.category)}
              </Text>
              <DisclosureChevron
                expanded={expanded}
                color={THEME.textSecondary}
              />
            </View>
            <View style={styles.figures}>
              <Text style={[TYPE.caption, { color: THEME.textSecondary }]}>
                {spentLabel}
                {limit > 0 ? ` of ${limitLabel} spent` : " spent"}
              </Text>
              <Text
                style={[
                  TYPE.caption,
                  { color: statusColor, fontWeight: "600" },
                ]}
              >
                {remainingLabel ?? "No limit"}
                {remainingLabel != null &&
                  (ratio > 1 ? " · Over budget" : " left")}
              </Text>
            </View>
            {limit > 0 && (
              <ProgressTrack
                label={`${budget.category} spending progress`}
                percent={percent}
                description={`${percent}% used, ${status}`}
                color={statusColor}
              />
            )}
            {expanded && (
              <Text style={[TYPE.caption, { color: statusColor }]}>
                {status}
              </Text>
            )}
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
    </View>
  );
});
export default BudgetReservoirRow;

const styles = StyleSheet.create({
  row: {
    gap: BRAND.spacing.sm,
    paddingVertical: 12,
    paddingHorizontal: BRAND.spacing.md,
  },
  heading: {
    flexDirection: "row",
    alignItems: "center",
    gap: BRAND.spacing.sm,
  },
  title: { flex: 1 },
  figures: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: BRAND.spacing.xs,
  },
});
