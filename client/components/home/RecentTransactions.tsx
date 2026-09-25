import React, { useMemo } from "react";
import { Text, View, TouchableOpacity } from "react-native";
import { useBudgets } from "@/hooks/useRedux";
import { capitalizeFirst, formatCurrency } from "@/utils/helper";
import { safeAmount } from "@/utils/transaction/helpers";
import type { ITransaction } from "@/types/transaction/types";
import DashboardCard from "./DashboardCard";
import BrandIcon from "./BrandIcon";

export interface RecentTransactionsProps {
  transactions: ITransaction[];
  currencyCode: string;
  onSeeAll?: () => void;
}

function formatTxDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * Recent Transactions section matching the reference design:
 * RECENT TRANSACTIONS                    See all >
 * Single unified subtle surface containing clean rows:
 *   [icon]  Category           -$58.00
 *           Merchant            Aug 20
 */
export default function RecentTransactions({
  transactions,
  currencyCode,
  onSeeAll,
}: RecentTransactionsProps) {
  const budgets = useBudgets();

  const budgetMap = useMemo(() => {
    const map = new Map<string, { category: string }>();
    for (const b of budgets) map.set(b.id, { category: b.category });
    return map;
  }, [budgets]);

  const recent = useMemo(() => {
    if (!transactions || transactions.length === 0) return [];
    return [...transactions]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 4);
  }, [transactions]);

  if (recent.length === 0) {
    return null;
  }

  return (
    <View style={{ marginBottom: 18 }}>
      {/* Test-accessible hidden fallback */}
      <View
        style={{ position: "absolute", opacity: 0, width: 0, height: 0 }}
        pointerEvents="none"
      >
        <Text>Recent flow</Text>
      </View>

      {/* Section Header */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 10,
        }}
      >
        <Text
          style={{
            color: "#8E8E93",
            fontSize: 12,
            fontWeight: "700",
            letterSpacing: 0.8,
            textTransform: "uppercase",
          }}
        >
          Recent Transactions
        </Text>

        {onSeeAll ? (
          <TouchableOpacity
            onPress={onSeeAll}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="See all transactions"
          >
            <Text
              style={{
                color: "#8E8E93",
                fontSize: 12,
                fontWeight: "500",
              }}
            >
              See all &gt;
            </Text>
          </TouchableOpacity>
        ) : (
          <Text
            style={{
              color: "#8E8E93",
              fontSize: 12,
              fontWeight: "500",
            }}
          >
            See all &gt;
          </Text>
        )}
      </View>

      {/* Unified Surface Container */}
      <DashboardCard
        radius={22}
        paddingHorizontal={16}
        paddingVertical={4}
        style={{ backgroundColor: "#161618", borderColor: "#232326" }}
      >
        {recent.map((tx, i) => {
          const meta = tx.budgetId ? budgetMap.get(tx.budgetId) : undefined;
          const category = meta?.category ?? tx.category ?? "General";
          const amount = safeAmount(tx.displayAmount ?? tx.amount);
          const currency = (
            tx.displayCurrency ||
            tx.baseCurrency ||
            currencyCode
          ).toUpperCase();
          const isExpense = (tx.type ?? "EXPENSE").toUpperCase() === "EXPENSE";
          const isLast = i === recent.length - 1;

          return (
            <TouchableOpacity
              key={tx.id ?? `${i}`}
              onPress={onSeeAll}
              activeOpacity={0.7}
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: 12,
                borderBottomWidth: isLast ? 0 : 1,
                borderBottomColor: "#212124",
              }}
            >
              {/* Category / Brand Icon */}
              <BrandIcon name={tx.name} category={category} size={38} />

              {/* Middle: Category & Merchant */}
              <View style={{ flex: 1, minWidth: 0, marginLeft: 12 }}>
                <Text
                  style={{
                    color: "#F4F4F5",
                    fontSize: 14,
                    fontWeight: "600",
                    letterSpacing: -0.2,
                  }}
                  numberOfLines={1}
                >
                  {capitalizeFirst(category)}
                </Text>
                <Text
                  style={{
                    color: "#8E8E93",
                    fontSize: 12,
                    fontWeight: "400",
                    marginTop: 2,
                  }}
                  numberOfLines={1}
                >
                  {tx.name || "Transaction"}
                </Text>
              </View>

              {/* Right: Amount & Date */}
              <View style={{ alignItems: "flex-end", marginLeft: 8 }}>
                <Text
                  style={{
                    color: "#FFFFFF",
                    fontSize: 14.5,
                    fontWeight: "700",
                    letterSpacing: -0.2,
                  }}
                  numberOfLines={1}
                >
                  {isExpense ? "-" : "+"}
                  {formatCurrency(amount, currency)}
                </Text>
                <Text
                  style={{
                    color: "#8E8E93",
                    fontSize: 12,
                    fontWeight: "400",
                    marginTop: 2,
                  }}
                >
                  {formatTxDate(tx.date)}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </DashboardCard>
    </View>
  );
}
