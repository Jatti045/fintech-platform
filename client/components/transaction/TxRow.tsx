import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { BRAND } from "@/constants/ThemePalettes";
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

  const isExpense =
    (tx.type ?? "EXPENSE").toUpperCase() === "EXPENSE" &&
    Number(tx.amount) >= 0;
  const rowDate = useMemo(() => formatRowDate(tx.date), [tx.date]);

  const direction = isExpense ? "−" : "+";
  const amountLabel = `${direction}${formatCurrency(Math.abs(amountToDisplay), currencyToDisplay)}`;
  const tone = tx.isTransfer
    ? THEME.textSecondary
    : isExpense
      ? THEME.danger
      : THEME.success;

  return (
    <SwipeableRow onDelete={() => onDelete(tx.id)} dangerColor={THEME.danger}>
      <TouchableOpacity
        activeOpacity={0.75}
        onPress={() => onEdit(tx)}
        onLongPress={() => {
          hapticHeavy();
          onDelete(tx.id);
        }}
        accessibilityRole="button"
        accessibilityLabel={`${tx.name}, ${capitalizeFirst(displayCategory)}${tx.isTransfer ? ", Transfer" : ""}, ${amountLabel}, ${rowDate}${originalReference ? `, ${originalReference}` : ""}`}
        accessibilityHint="Tap to edit. Long press or swipe to delete."
        accessibilityActions={[
          { name: "activate", label: "Edit transaction" },
          { name: "delete", label: "Delete transaction" },
        ]}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === "delete") onDelete(tx.id);
          else if (event.nativeEvent.actionName === "activate") onEdit(tx);
        }}
        style={{
          backgroundColor: THEME.surface,
          borderLeftWidth: 1,
          borderRightWidth: 1,
          borderColor: THEME.border,
          borderBottomWidth: isLast ? 1 : StyleSheet.hairlineWidth,
          borderBottomLeftRadius: isLast ? BRAND.radius.card : 0,
          borderBottomRightRadius: isLast ? BRAND.radius.card : 0,
          padding: BRAND.spacing.md,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            alignItems: "center",
            gap: BRAND.spacing.sm,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: BRAND.spacing.sm,
              flexGrow: 1,
              flexBasis: 150,
            }}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 12,
                backgroundColor: THEME.subtleSurface,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Feather
                name={
                  tx.isTransfer
                    ? "repeat"
                    : isExpense
                      ? "arrow-up-right"
                      : "arrow-down-left"
                }
                size={18}
                color={tx.isTransfer ? THEME.textSecondary : THEME.primary}
              />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                style={{
                  color: THEME.textPrimary,
                  fontWeight: "600",
                  fontSize: 15,
                }}
                numberOfLines={2}
                ellipsizeMode="tail"
              >
                {tx.name || "Transaction"}
              </Text>
              <Text
                style={{
                  color: THEME.textSecondary,
                  fontSize: 12,
                  lineHeight: 18,
                  marginTop: BRAND.spacing.xs,
                }}
                numberOfLines={2}
              >
                {capitalizeFirst(displayCategory)}
                {tx.isTransfer ? "  ·  Transfer" : ""} · {rowDate}
              </Text>
            </View>
          </View>
          <Text
            style={{
              color: tone,
              fontWeight: "700",
              fontSize: 17,
              fontVariant: ["tabular-nums"],
              textAlign: "right",
              flexShrink: 1,
              maxWidth: "100%",
              marginLeft: "auto",
            }}
          >
            {amountLabel}
          </Text>
        </View>
        {originalReference ? (
          <Text
            style={{
              color: THEME.textSecondary,
              fontSize: 12,
              lineHeight: 18,
              marginTop: BRAND.spacing.sm,
              textAlign: "right",
            }}
          >
            {originalReference}
          </Text>
        ) : null}
      </TouchableOpacity>
    </SwipeableRow>
  );
});

export default TransactionRow;
