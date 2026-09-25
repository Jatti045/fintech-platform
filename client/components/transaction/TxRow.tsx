import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useBudgets, useTheme } from "@/hooks/useRedux";
import { capitalizeFirst, formatCurrency } from "@/utils/helper";
import { safeAmount } from "../../utils/transaction/helpers";
import type { TransactionItem } from "../../types/transaction/types";
import { hapticHeavy } from "@/utils/haptics";
import SwipeableRow from "@/components/global/SwipeableRow";

function formatRowDate(dateStr?: string | Date): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${months[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

export interface TransactionRowProps {
  tx: TransactionItem;
  isLast?: boolean;
  onEdit: (tx: TransactionItem) => void;
  onDelete: (id: string) => void;
}

/**
 * TransactionRow:
 * - Text-focused clean row (zero icons/logos/avatars)
 * - Category as primary label (white) + Merchant/Account name as secondary (muted gray)
 * - Transfer indicator if applicable
 * - Row date ("Aug 20") right-aligned before amount
 * - Semantic red for expenses (-$58.00), semantic green for income (+$2,500.00)
 * - Subtle chevron (>)
 * - Hairline divider between rows, bottom-rounded if last row in card
 * - Press to edit, long press to delete, swipe to delete
 */
const TransactionRow = React.memo(function TransactionRow({
  tx,
  isLast = false,
  onEdit,
  onDelete,
}: TransactionRowProps) {
  const { THEME } = useTheme();
  const budgets = useBudgets();
  const displayCurrency = (
    tx.displayCurrency ||
    tx.baseCurrency ||
    "USD"
  ).toUpperCase();

  const normalizedOriginalCurrency =
    tx.originalCurrency?.toUpperCase() ||
    tx.baseCurrency?.toUpperCase() ||
    null;

  const normalizedOriginalAmount =
    tx.originalAmount != null ? Number(tx.originalAmount) : Number(tx.amount);

  const shouldShowOriginalSpentCurrency =
    normalizedOriginalCurrency != null &&
    normalizedOriginalCurrency !== displayCurrency;

  const amountToDisplay = safeAmount(
    shouldShowOriginalSpentCurrency
      ? normalizedOriginalAmount
      : (tx.displayAmount ?? tx.amount),
  );
  const currencyToDisplay = shouldShowOriginalSpentCurrency
    ? normalizedOriginalCurrency || displayCurrency
    : displayCurrency;

  const originalReference = useMemo(() => {
    if (shouldShowOriginalSpentCurrency) {
      if (tx.displayAmount == null) return null;
      if (displayCurrency === currencyToDisplay) return null;
      return `≈ ${formatCurrency(Number(tx.displayAmount), displayCurrency)} (${displayCurrency})`;
    }

    if (tx.originalAmount == null || !normalizedOriginalCurrency) return null;
    if (normalizedOriginalCurrency === displayCurrency) return null;
    return `Orig ${formatCurrency(Number(tx.originalAmount), normalizedOriginalCurrency)} (${normalizedOriginalCurrency})`;
  }, [
    shouldShowOriginalSpentCurrency,
    tx.displayAmount,
    tx.originalAmount,
    normalizedOriginalCurrency,
    displayCurrency,
    currencyToDisplay,
  ]);

  const displayCategory = useMemo(() => {
    const budgetId = tx.budgetId ?? tx.budget?.id;
    if (budgetId) {
      const linked = budgets.find((b) => b.id === budgetId);
      if (linked) return linked.category;
    }

    return tx.category;
  }, [tx.budgetId, tx.budget, tx.category, budgets]);

  const isExpense = (tx.type ?? "EXPENSE").toUpperCase() === "EXPENSE";
  const rowDate = useMemo(() => formatRowDate(tx.date), [tx.date]);

  return (
    <SwipeableRow onDelete={() => onDelete(tx.id)} dangerColor={THEME.danger}>
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => onEdit(tx)}
        onLongPress={() => {
          hapticHeavy();
          onDelete(tx.id);
        }}
        accessibilityRole="button"
        accessibilityLabel={`${capitalizeFirst(displayCategory)}, ${formatCurrency(amountToDisplay, currencyToDisplay)}`}
        style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: THEME.surface,
          borderLeftWidth: 1,
          borderRightWidth: 1,
          borderColor: THEME.border,
          borderBottomWidth: isLast ? 1 : StyleSheet.hairlineWidth,
          borderBottomColor: THEME.border,
          borderBottomLeftRadius: isLast ? 20 : 0,
          borderBottomRightRadius: isLast ? 20 : 0,
          paddingHorizontal: 16,
          paddingVertical: 14,
        }}
      >
        {/* Category & Merchant Info (Reflowed to left edge) */}
        <View style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
          <Text
            style={{
              color: THEME.textPrimary,
              fontWeight: "600",
              fontSize: 14.5,
              letterSpacing: -0.1,
            }}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {capitalizeFirst(displayCategory)}
            {tx.isTransfer ? "  ·  Transfer" : ""}
          </Text>
          <Text
            style={{
              color: THEME.textSecondary,
              fontSize: 13,
              marginTop: 2,
            }}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {tx.name}
          </Text>
          {originalReference ? (
            <Text
              style={{
                color: THEME.placeholderText,
                fontSize: 11,
                marginTop: 1,
              }}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {originalReference}
            </Text>
          ) : null}
        </View>

        {/* Date, Amount & Chevron */}
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          {rowDate ? (
            <Text
              style={{
                color: THEME.textSecondary,
                fontSize: 13,
                marginRight: 14,
                fontWeight: "400",
              }}
            >
              {rowDate}
            </Text>
          ) : null}

          <Text
            style={{
              color: isExpense ? THEME.danger : THEME.success,
              fontWeight: "700",
              fontSize: 14.5,
              letterSpacing: -0.2,
            }}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {isExpense ? "−" : "+"}
            {formatCurrency(amountToDisplay, currencyToDisplay)}
          </Text>

          <Feather
            name="chevron-right"
            size={14}
            color={THEME.textSecondary}
            style={{ marginLeft: 8 }}
          />
        </View>
      </TouchableOpacity>
    </SwipeableRow>
  );
});

export default TransactionRow;
