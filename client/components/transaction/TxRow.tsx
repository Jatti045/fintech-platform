import React, { useMemo } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useBudgets, useTheme } from "@/hooks/useRedux";
import { capitalizeFirst, formatCurrency } from "@/utils/helper";
import { safeAmount } from "../../utils/transaction/helpers";
import type { TransactionItem } from "../../types/transaction/types";
import { hapticHeavy } from "@/utils/haptics";
import SwipeableRow from "@/components/global/SwipeableRow";
import GlassPanel from "@/components/global/GlassPanel";

/**
 * Single transaction row with press-to-edit, long-press-to-delete, and
 * swipe-right-to-reveal-delete behaviour.
 * Reads theme colours from the `useTheme` hook internally.
 */
const TransactionRow = React.memo(function TransactionRow({
  tx,
  onEdit,
  onDelete,
}: {
  tx: TransactionItem;
  onEdit: (tx: TransactionItem) => void;
  onDelete: (id: string) => void;
}) {
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
    if (tx.budgetId) {
      const linked = budgets.find((b) => b.id === tx.budgetId);
      if (linked) return linked.category;
    }

    return tx.category;
  }, [tx.budgetId, tx.category, budgets]);

  const isExpense = (tx.type ?? "EXPENSE").toUpperCase() === "EXPENSE";

  return (
    <SwipeableRow onDelete={() => onDelete(tx.id)} dangerColor={THEME.danger}>
      <GlassPanel padding={10} radius={16} style={{ marginBottom: 10 }}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => onEdit(tx)}
          onLongPress={() => {
            hapticHeavy();
            onDelete(tx.id);
          }}
          accessibilityRole="button"
          accessibilityLabel={`${capitalizeFirst(displayCategory)}, ${formatCurrency(amountToDisplay, currencyToDisplay)}`}
        >
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                style={{ color: THEME.textPrimary, fontWeight: "700", fontSize: 14 }}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {capitalizeFirst(displayCategory)}
                {tx.isTransfer ? "  ·  Transfer" : ""}
              </Text>
              <Text
                style={{ color: THEME.textSecondary, fontSize: 12, marginTop: 1 }}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {tx.name}
              </Text>
              {originalReference ? (
                <Text
                  style={{ color: THEME.textSecondary, fontSize: 11 }}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {originalReference}
                </Text>
              ) : null}
            </View>

            <View style={{ marginLeft: 10, alignItems: "flex-end" }}>
              <Text
                style={{
                  color: isExpense ? THEME.danger : THEME.success,
                  fontWeight: "800",
                  fontSize: 14,
                }}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {isExpense ? "− " : "+ "}
                {formatCurrency(amountToDisplay, currencyToDisplay)}
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      </GlassPanel>
    </SwipeableRow>
  );
});

export default TransactionRow;
