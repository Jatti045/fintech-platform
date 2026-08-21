import React, { useMemo } from "react";
import { View, Text } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { formatCurrency } from "@/utils/helper";
import { useTransactions, useTheme, useUser } from "@/hooks/useRedux";
import { useTransactionDisplayAmounts } from "@/hooks/transaction/useTransactionDisplayAmounts";

/**
 * Beautiful transaction overview header featuring:
 * - Total number of transactions
 * - Total spent amount
 * - Average transaction amount
 * - Monthly spending trend indicator
 */
export default function TransactionOverviewHeader() {
  const { THEME } = useTheme();
  const transactions = useTransactions();
  const user = useUser();
  const activeCurrency = user?.currency || "USD";
  const { displayTransactions } = useTransactionDisplayAmounts(
    transactions,
    activeCurrency,
  );

  // Calculate statistics
  const stats = useMemo(() => {
    if (displayTransactions.length === 0) {
      return {
        totalCount: 0,
        totalSpent: 0,
        averageTransaction: 0,
        expenseCount: 0,
        incomeCount: 0,
        largestExpense: 0,
        trend: "neutral" as "up" | "down" | "neutral",
      };
    }

    const expenses = displayTransactions.filter(
      (t: any) =>
        !t.isTransfer && (t.type ?? "EXPENSE").toUpperCase() === "EXPENSE",
    );
    const income = displayTransactions.filter(
      (t: any) =>
        !t.isTransfer && (t.type ?? "EXPENSE").toUpperCase() === "INCOME",
    );

    const totalSpent = expenses.reduce(
      (sum: number, t: any) => sum + Number(t.displayAmount ?? t.amount ?? 0),
      0,
    );
    const averageTransaction =
      expenses.length > 0 ? totalSpent / expenses.length : 0;
    const largestExpense =
      expenses.length > 0
        ? Math.max(
            ...expenses.map((t: any) =>
              Number(t.displayAmount ?? t.amount ?? 0),
            ),
          )
        : 0;

    // Calculate trend (last 7 vs previous 7)
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const recentExpenses = expenses.filter((t: any) => {
      const txDate = new Date(t.date);
      return txDate >= sevenDaysAgo && txDate <= now;
    });
    const previousExpenses = expenses.filter((t: any) => {
      const txDate = new Date(t.date);
      return txDate >= fourteenDaysAgo && txDate < sevenDaysAgo;
    });

    const recentTotal = recentExpenses.reduce(
      (sum: number, t: any) => sum + Number(t.displayAmount ?? t.amount ?? 0),
      0,
    );
    const previousTotal = previousExpenses.reduce(
      (sum: number, t: any) => sum + Number(t.displayAmount ?? t.amount ?? 0),
      0,
    );

    let trend: "up" | "down" | "neutral" = "neutral";
    if (previousTotal > 0) {
      if (recentTotal > previousTotal * 1.1) {
        trend = "up";
      } else if (recentTotal < previousTotal * 0.9) {
        trend = "down";
      }
    }

    return {
      totalCount: displayTransactions.length,
      totalSpent,
      averageTransaction,
      expenseCount: expenses.length,
      incomeCount: income.length,
      largestExpense,
      trend,
    };
  }, [displayTransactions]);

  const getTrendInfo = () => {
    if (stats.trend === "up") {
      return {
        label: "Spending Up",
        color: THEME.warning,
        icon: "trending-up",
      };
    }
    if (stats.trend === "down") {
      return {
        label: "Spending Down",
        color: THEME.success,
        icon: "trending-down",
      };
    }
    return {
      label: "Stable Spending",
      color: THEME.primary,
      icon: "minus",
    };
  };

  const trendInfo = getTrendInfo();

  if (stats.totalCount === 0) return null;

  return (
    <View style={{ marginBottom: 24 }}>
      {/* Main gradient card */}
      <LinearGradient
        colors={[THEME.primary, THEME.secondary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          borderRadius: 24,
          padding: 24,
          overflow: "hidden",
          marginBottom: 16,
        }}
      >
        {/* Decorative elements */}
        <View
          style={{
            position: "absolute",
            width: 200,
            height: 200,
            borderRadius: 100,
            backgroundColor: "rgba(255, 255, 255, 0.1)",
            top: -50,
            right: -50,
          }}
        />
        <View
          style={{
            position: "absolute",
            width: 150,
            height: 150,
            borderRadius: 75,
            backgroundColor: "rgba(255, 255, 255, 0.05)",
            bottom: -30,
            left: -40,
          }}
        />

        {/* Header */}
        <View style={{ zIndex: 1, marginBottom: 24 }}>
          <Text
            style={{
              color: "rgba(255, 255, 255, 0.7)",
              fontSize: 12,
              fontWeight: "600",
              marginBottom: 8,
              textTransform: "uppercase",
              letterSpacing: 0.5,
            }}
          >
            Transaction Summary
          </Text>

          {/* Main metrics row */}
          <View
            style={{ flexDirection: "row", justifyContent: "space-between" }}
          >
            <View>
              <Text
                style={{
                  color: "rgba(255, 255, 255, 0.7)",
                  fontSize: 12,
                  fontWeight: "500",
                  marginBottom: 4,
                }}
              >
                Total Spent
              </Text>
              <Text
                style={{
                  color: "white",
                  fontSize: 32,
                  fontWeight: "900",
                  letterSpacing: -1,
                }}
              >
                $
                {formatCurrency(stats.totalSpent, activeCurrency).replace(
                  "$",
                  "",
                )}
              </Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text
                style={{
                  color: "rgba(255, 255, 255, 0.7)",
                  fontSize: 12,
                  fontWeight: "500",
                  marginBottom: 4,
                }}
              >
                Transactions
              </Text>
              <Text
                style={{
                  color: "rgba(255, 255, 255, 0.95)",
                  fontSize: 28,
                  fontWeight: "700",
                }}
              >
                {stats.expenseCount}
              </Text>
            </View>
          </View>
        </View>

        {/* Divider */}
        <View
          style={{
            height: 1,
            backgroundColor: "rgba(255, 255, 255, 0.2)",
            marginBottom: 16,
            zIndex: 1,
          }}
        />

        {/* Secondary metrics */}
        <View
          style={{
            zIndex: 1,
            flexDirection: "row",
            justifyContent: "space-between",
          }}
        >
          <View>
            <Text
              style={{
                color: "rgba(255, 255, 255, 0.7)",
                fontSize: 12,
                fontWeight: "500",
                marginBottom: 4,
              }}
            >
              Average
            </Text>
            <Text
              style={{
                color: "rgba(255, 255, 255, 0.9)",
                fontSize: 18,
                fontWeight: "700",
              }}
            >
              $
              {formatCurrency(stats.averageTransaction, activeCurrency).replace(
                "$",
                "",
              )}
            </Text>
          </View>
          <View>
            <Text
              style={{
                color: "rgba(255, 255, 255, 0.7)",
                fontSize: 12,
                fontWeight: "500",
                marginBottom: 4,
              }}
            >
              Largest
            </Text>
            <Text
              style={{
                color: "rgba(255, 255, 255, 0.9)",
                fontSize: 18,
                fontWeight: "700",
              }}
            >
              $
              {formatCurrency(stats.largestExpense, activeCurrency).replace(
                "$",
                "",
              )}
            </Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text
              style={{
                color: "rgba(255, 255, 255, 0.7)",
                fontSize: 12,
                fontWeight: "500",
                marginBottom: 4,
              }}
            >
              Income
            </Text>
            <Text
              style={{
                color: "rgba(255, 255, 255, 0.9)",
                fontSize: 18,
                fontWeight: "700",
              }}
            >
              {stats.incomeCount}
            </Text>
          </View>
        </View>
      </LinearGradient>

      {/* Trend indicator */}
      <View
        style={{
          backgroundColor: THEME.surface,
          borderRadius: 20,
          padding: 20,
          borderColor: THEME.border,
          borderWidth: 1,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
            <View
              style={{
                width: 12,
                height: 12,
                borderRadius: 6,
                backgroundColor: trendInfo.color,
                marginRight: 12,
              }}
            />
            <View>
              <Text
                style={{
                  color: THEME.textPrimary,
                  fontWeight: "700",
                  fontSize: 14,
                }}
              >
                {trendInfo.label}
              </Text>
              <Text
                style={{
                  color: THEME.textSecondary,
                  fontSize: 12,
                  marginTop: 2,
                }}
              >
                Last 7 days vs previous week
              </Text>
            </View>
          </View>
          <Feather
            name={trendInfo.icon as any}
            size={20}
            color={trendInfo.color}
          />
        </View>
      </View>
    </View>
  );
}
