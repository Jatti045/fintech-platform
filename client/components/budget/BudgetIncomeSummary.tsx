import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { formatCurrency } from "@/utils/helper";

export interface BudgetIncomeSummaryProps {
  income: number;
  totalSpent: number;
  totalLimit?: number;
  currencyCode?: string;
  onPressLimit?: () => void;
}

/**
 * BudgetIncomeSummary — matches Section 6 of the mockup:
 * - Income icon with monthly income amount
 * - "No limit set >" (or total limit)
 * - Mint green progress bar showing spending relative to income
 * - $X spent vs $Y remaining
 */
export default function BudgetIncomeSummary({
  income,
  totalSpent,
  totalLimit = 0,
  currencyCode = "USD",
  onPressLimit,
}: BudgetIncomeSummaryProps) {
  const displayIncome = Math.max(0, income);
  const remaining = Math.max(0, displayIncome - totalSpent);
  const ratio = displayIncome > 0 ? Math.min(1, totalSpent / displayIncome) : 0;
  const percent = Math.round(ratio * 100);

  return (
    <View
      style={{
        backgroundColor: "#121214",
        borderRadius: 20,
        borderWidth: 1,
        borderColor: "#1F1F23",
        padding: 16,
        marginBottom: 16,
      }}
    >
      {/* ── Top row: Income amount + Limit indicator ──────────────────── */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              backgroundColor: "#162E20",
              alignItems: "center",
              justifyContent: "center",
              marginRight: 10,
            }}
          >
            <Feather name="arrow-up" size={18} color="#34D399" />
          </View>
          <View>
            <Text
              style={{
                color: "#8E8E93",
                fontSize: 11,
                fontWeight: "700",
                letterSpacing: 0.5,
              }}
            >
              INCOME
            </Text>
            <Text
              style={{
                color: "#FFFFFF",
                fontSize: 20,
                fontWeight: "800",
                letterSpacing: -0.5,
                marginTop: 1,
              }}
            >
              {formatCurrency(displayIncome, currencyCode)}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={onPressLimit}
          activeOpacity={0.7}
          disabled={!onPressLimit}
          style={{ flexDirection: "row", alignItems: "center" }}
        >
          <Text style={{ color: "#8E8E93", fontSize: 13, marginRight: 3 }}>
            {totalLimit > 0
              ? `Limit: ${formatCurrency(totalLimit, currencyCode)}`
              : "No limit set"}
          </Text>
          <Feather name="chevron-right" size={14} color="#8E8E93" />
        </TouchableOpacity>
      </View>

      {/* ── Progress bar ────────────────────────────────────────────────── */}
      <View
        style={{
          height: 7,
          backgroundColor: "#1F1F24",
          borderRadius: 3.5,
          marginVertical: 12,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            height: "100%",
            width: `${percent}%`,
            backgroundColor: "#34D399",
            borderRadius: 3.5,
          }}
        />
      </View>

      {/* ── Bottom row: Spent vs Remaining ──────────────────────────────── */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Text style={{ color: "#8E8E93", fontSize: 12.5, fontWeight: "500" }}>
          {formatCurrency(totalSpent, currencyCode)} spent
        </Text>
        <Text style={{ color: "#8E8E93", fontSize: 12.5, fontWeight: "500" }}>
          {formatCurrency(remaining, currencyCode)} remaining
        </Text>
      </View>
    </View>
  );
}
