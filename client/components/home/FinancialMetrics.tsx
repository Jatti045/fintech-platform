import React from "react";
import { View, Text } from "react-native";
import { Feather, Ionicons } from "@expo/vector-icons";
import { formatCurrency } from "@/utils/helper";
import DashboardCard from "./DashboardCard";

export interface FinancialMetricsProps {
  monthlyIncome: number;
  totalSpent: number;
  currencyCode: string;
}

/**
 * Three compact metric cards below the main overview:
 * Income | Spent | Net
 * Visually quiet, subtle surfaces, restrained semantic colors.
 */
export default function FinancialMetrics({
  monthlyIncome,
  totalSpent,
  currencyCode,
}: FinancialMetricsProps) {
  const income = Math.max(0, monthlyIncome || 0);
  const spent = Math.max(0, totalSpent || 0);
  const net = income - spent;

  const formattedIncome = formatCurrency(income, currencyCode);
  const formattedSpent = formatCurrency(spent, currencyCode);
  const formattedNet = formatCurrency(net, currencyCode);

  return (
    <View
      style={{
        flexDirection: "row",
        gap: 10,
        marginBottom: 14,
      }}
    >
      {/* 1. Income Card */}
      <DashboardCard radius={18} padding={12} style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <View
            style={{
              width: 24,
              height: 24,
              borderRadius: 12,
              backgroundColor: "#162E20",
              alignItems: "center",
              justifyContent: "center",
              marginRight: 6,
            }}
          >
            <Feather name="arrow-up" size={13} color="#4ADE80" />
          </View>
          <Text
            style={{
              color: "#8E8E93",
              fontSize: 12,
              fontWeight: "500",
            }}
            numberOfLines={1}
          >
            Income
          </Text>
        </View>

        <Text
          style={{
            color: "#FFFFFF",
            fontSize: 15,
            fontWeight: "700",
            marginVertical: 6,
            letterSpacing: -0.3,
          }}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {formattedIncome}
        </Text>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            flexWrap: "nowrap",
          }}
        >
          <Text
            style={{
              color: "#4ADE80",
              fontSize: 10.5,
              fontWeight: "600",
            }}
          >
            ↗ +12%
          </Text>
          <Text
            style={{
              color: "#71717A",
              fontSize: 10.5,
              fontWeight: "400",
              marginLeft: 2,
            }}
            numberOfLines={1}
          >
            {" "}
            vs. last mo
          </Text>
        </View>
      </DashboardCard>

      {/* 2. Spent Card */}
      <DashboardCard radius={18} padding={12} style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <View
            style={{
              width: 24,
              height: 24,
              borderRadius: 12,
              backgroundColor: "#2E181C",
              alignItems: "center",
              justifyContent: "center",
              marginRight: 6,
            }}
          >
            <Feather name="arrow-down" size={13} color="#F87171" />
          </View>
          <Text
            style={{
              color: "#8E8E93",
              fontSize: 12,
              fontWeight: "500",
            }}
            numberOfLines={1}
          >
            Spent
          </Text>
        </View>

        <Text
          style={{
            color: "#FFFFFF",
            fontSize: 15,
            fontWeight: "700",
            marginVertical: 6,
            letterSpacing: -0.3,
          }}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {formattedSpent}
        </Text>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            flexWrap: "nowrap",
          }}
        >
          <Text
            style={{
              color: "#F87171",
              fontSize: 10.5,
              fontWeight: "600",
            }}
          >
            ↗ +8%
          </Text>
          <Text
            style={{
              color: "#71717A",
              fontSize: 10.5,
              fontWeight: "400",
              marginLeft: 2,
            }}
            numberOfLines={1}
          >
            {" "}
            vs. last mo
          </Text>
        </View>
      </DashboardCard>

      {/* 3. Net Card */}
      <DashboardCard radius={18} padding={12} style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <View
            style={{
              width: 24,
              height: 24,
              borderRadius: 12,
              backgroundColor: "#202024",
              alignItems: "center",
              justifyContent: "center",
              marginRight: 6,
            }}
          >
            <Ionicons name="wallet-outline" size={13} color="#A1A1AA" />
          </View>
          <Text
            style={{
              color: "#8E8E93",
              fontSize: 12,
              fontWeight: "500",
            }}
            numberOfLines={1}
          >
            Net
          </Text>
        </View>

        <Text
          style={{
            color: "#FFFFFF",
            fontSize: 15,
            fontWeight: "700",
            marginVertical: 6,
            letterSpacing: -0.3,
          }}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {formattedNet}
        </Text>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            flexWrap: "nowrap",
          }}
        >
          <Text
            style={{
              color: "#4ADE80",
              fontSize: 10.5,
              fontWeight: "600",
            }}
          >
            ↗ +4%
          </Text>
          <Text
            style={{
              color: "#71717A",
              fontSize: 10.5,
              fontWeight: "400",
              marginLeft: 2,
            }}
            numberOfLines={1}
          >
            {" "}
            vs. last mo
          </Text>
        </View>
      </DashboardCard>
    </View>
  );
}
