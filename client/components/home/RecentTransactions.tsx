import React, { useMemo } from "react";
import { Text, View, TouchableOpacity } from "react-native";
import { useBudgets, useTheme } from "@/hooks/useRedux";
import { formatCurrency } from "@/utils/helper";
import { safeAmount } from "@/utils/transaction/helpers";
import type { ITransaction } from "@/types/transaction/types";
import ActivityIcon from "./ActivityIcon";
import DashboardSection from "./DashboardSection";
import DashboardState from "./DashboardState";

export interface RecentTransactionsProps {
  transactions: ITransaction[];
  currencyCode: string;
  onSeeAll?: () => void;
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
}
function formatTxDate(value: string) {
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? "Date unavailable"
    : d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      });
}
export default function RecentTransactions({
  transactions,
  currencyCode,
  onSeeAll,
  loading,
  error,
  onRetry,
}: RecentTransactionsProps) {
  const { THEME } = useTheme();
  const budgets = useBudgets();
  const budgetMap = useMemo(
    () => new Map(budgets.map((b) => [b.id, b.category])),
    [budgets],
  );
  const recent = useMemo(
    () =>
      [...(transactions || [])]
        .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
        .slice(0, 4),
    [transactions],
  );
  return (
    <DashboardSection
      title="Recent Transactions"
      action="See all transactions"
      onPress={onSeeAll}
    >
      <View>
        {error && (
          <DashboardState
            error
            message="Transactions could not be refreshed."
            onRetry={onRetry}
          />
        )}
        {!recent.length && !error && (
          <DashboardState
            loading={loading}
            message={
              loading
                ? "Loading transactions…"
                : "No transactions this month. Your latest activity will appear here."
            }
          />
        )}
        {recent.map((tx, i) => {
          const category =
            (tx.budgetId && budgetMap.get(tx.budgetId)) ||
            tx.category ||
            "General";
          const amount = safeAmount(tx.displayAmount ?? tx.amount);
          const currency = (
            tx.displayCurrency ||
            tx.baseCurrency ||
            currencyCode
          ).toUpperCase();
          const expense =
            (tx.type ?? "EXPENSE").toUpperCase() === "EXPENSE" && amount >= 0;
          const transfer = !!tx.isTransfer;
          const sign = expense ? "−" : "+";
          const color = transfer
            ? THEME.textSecondary
            : expense
              ? THEME.textPrimary
              : THEME.success;
          return (
            <TouchableOpacity
              key={tx.id ?? i}
              onPress={onSeeAll}
              disabled={!onSeeAll}
              accessibilityRole={onSeeAll ? "button" : undefined}
              accessibilityLabel={`${tx.name || "Transaction"}, ${transfer ? "Transfer" : category}, ${sign}${formatCurrency(Math.abs(amount), currency)}, ${formatTxDate(tx.date)}`}
              style={{
                paddingVertical: 8,
                paddingBottom: i === recent.length - 1 ? 6 : 0,
                minHeight: 48,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <View
                  style={{
                    flex: 1,
                    minWidth: 0,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <ActivityIcon
                    category={category}
                    income={!expense}
                    transfer={transfer}
                  />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text
                      style={{
                        color: THEME.textPrimary,
                        fontSize: 15,
                        fontWeight: "600",
                      }}
                      numberOfLines={2}
                    >
                      {tx.name || "Transaction"}
                    </Text>
                    <Text
                      style={{
                        color: THEME.textSecondary,
                        fontSize: 12,
                        marginTop: 2,
                      }}
                    >
                      {transfer ? "Transfer · " : ""}
                      {formatTxDate(tx.date)}
                    </Text>
                  </View>
                </View>
                <Text
                  style={{
                    color,
                    fontSize: 15,
                    fontWeight: "700",
                    fontVariant: ["tabular-nums"],
                    textAlign: "right",
                    flexShrink: 1,
                    maxWidth: "100%",
                  }}
                >
                  {sign}
                  {formatCurrency(Math.abs(amount), currency)}
                </Text>
              </View>
              {i < recent.length - 1 && (
                <View
                  style={{
                    height: 1,
                    backgroundColor: THEME.border,
                    opacity: 0.5,
                    marginLeft: 48,
                    marginTop: 8,
                  }}
                />
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </DashboardSection>
  );
}
