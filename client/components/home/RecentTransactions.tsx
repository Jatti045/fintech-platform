import React, { useMemo } from "react";
import { Text, View, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useBudgets, useTheme } from "@/hooks/useRedux";
import { BRAND } from "@/constants/ThemePalettes";
import { capitalizeFirst, formatCurrency } from "@/utils/helper";
import { safeAmount } from "@/utils/transaction/helpers";
import type { ITransaction } from "@/types/transaction/types";
import DashboardCard from "./DashboardCard";
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
      title="Recent transactions"
      action="See all transactions"
      onPress={onSeeAll}
    >
      <DashboardCard paddingHorizontal={BRAND.spacing.md}>
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
                paddingVertical: BRAND.spacing.md,
                borderBottomWidth: i === recent.length - 1 ? 0 : 1,
                borderBottomColor: THEME.border,
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
                    flexGrow: 1,
                    flexBasis: 140,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: BRAND.spacing.sm,
                  }}
                >
                  <View
                    style={{
                      backgroundColor: THEME.subtleSurface,
                      width: 36,
                      height: 36,
                      borderRadius: 12,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Feather
                      name={
                        transfer
                          ? "repeat"
                          : expense
                            ? "arrow-up-right"
                            : "arrow-down-left"
                      }
                      size={18}
                      color={transfer ? THEME.textSecondary : THEME.primary}
                    />
                  </View>
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
                        marginTop: 4,
                      }}
                    >
                      {transfer ? "Transfer" : capitalizeFirst(category)} ·{" "}
                      {formatTxDate(tx.date)}
                    </Text>
                  </View>
                </View>
                <Text
                  style={{
                    color,
                    fontSize: 17,
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
            </TouchableOpacity>
          );
        })}
      </DashboardCard>
    </DashboardSection>
  );
}
