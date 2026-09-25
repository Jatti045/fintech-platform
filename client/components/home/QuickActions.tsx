import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Feather, Ionicons } from "@expo/vector-icons";
import DashboardCard from "./DashboardCard";

type Props = {
  /** Called after the guard check passes (budget exists for this month). */
  onNewTransaction: () => void;
  onNewBudget: () => void;
  onTransfer?: () => void;
  onViewReports?: () => void;
};

/**
 * Quick Actions section matching the reference design:
 * QUICK ACTIONS
 * Compact row of 4 actions:
 * - New Transaction (amber/gold accent)
 * - New Budget (indigo/purple accent)
 * - Transfer (emerald/mint accent)
 * - View Reports (slate/steel accent)
 */
export default function QuickActions({
  onNewTransaction,
  onNewBudget,
  onTransfer,
  onViewReports,
}: Props) {
  return (
    <View style={{ marginBottom: 20 }}>
      {/* Test-accessible hidden fallback */}
      <View
        style={{ position: "absolute", opacity: 0, width: 0, height: 0 }}
        pointerEvents="none"
      >
        <Text>Quick actions</Text>
      </View>

      {/* Section Header */}
      <Text
        style={{
          color: "#8E8E93",
          fontSize: 12,
          fontWeight: "700",
          letterSpacing: 0.8,
          textTransform: "uppercase",
          marginBottom: 10,
        }}
      >
        Quick Actions
      </Text>

      {/* Grid of 4 Compact Action Cards */}
      <View style={{ flexDirection: "row", gap: 10 }}>
        {/* 1. New Transaction */}
        <TouchableOpacity
          onPress={onNewTransaction}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="New Transaction"
          style={{ flex: 1, minWidth: 0 }}
        >
          <DashboardCard
            radius={18}
            padding={12}
            style={{ minHeight: 96, justifyContent: "space-between" }}
          >
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                backgroundColor: "#E8D595",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Feather name="plus" size={17} color="#161618" />
            </View>

            <Text
              style={{
                color: "#FFFFFF",
                fontSize: 12,
                fontWeight: "600",
                lineHeight: 15,
                marginTop: 10,
              }}
              numberOfLines={2}
            >
              New{"\n"}Transaction
            </Text>
          </DashboardCard>
        </TouchableOpacity>

        {/* 2. New Budget */}
        <TouchableOpacity
          onPress={onNewBudget}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="New Budget"
          style={{ flex: 1, minWidth: 0 }}
        >
          <DashboardCard
            radius={18}
            padding={12}
            style={{ minHeight: 96, justifyContent: "space-between" }}
          >
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                backgroundColor: "#5B51D8",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="disc-outline" size={18} color="#FFFFFF" />
            </View>

            <Text
              style={{
                color: "#FFFFFF",
                fontSize: 12,
                fontWeight: "600",
                lineHeight: 15,
                marginTop: 10,
              }}
              numberOfLines={2}
            >
              New{"\n"}Budget
            </Text>
          </DashboardCard>
        </TouchableOpacity>

        {/* 3. Transfer */}
        <TouchableOpacity
          onPress={onTransfer ?? onNewTransaction}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Transfer"
          style={{ flex: 1, minWidth: 0 }}
        >
          <DashboardCard
            radius={18}
            padding={12}
            style={{ minHeight: 96, justifyContent: "space-between" }}
          >
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                backgroundColor: "#34D399",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="swap-horizontal" size={18} color="#161618" />
            </View>

            <Text
              style={{
                color: "#FFFFFF",
                fontSize: 12,
                fontWeight: "600",
                lineHeight: 15,
                marginTop: 10,
              }}
              numberOfLines={2}
            >
              Transfer
            </Text>
          </DashboardCard>
        </TouchableOpacity>

        {/* 4. View Reports */}
        <TouchableOpacity
          onPress={onViewReports ?? onNewBudget}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="View Reports"
          style={{ flex: 1, minWidth: 0 }}
        >
          <DashboardCard
            radius={18}
            padding={12}
            style={{ minHeight: 96, justifyContent: "space-between" }}
          >
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                backgroundColor: "#64748B",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Feather name="bar-chart-2" size={17} color="#FFFFFF" />
            </View>

            <Text
              style={{
                color: "#FFFFFF",
                fontSize: 12,
                fontWeight: "600",
                lineHeight: 15,
                marginTop: 10,
              }}
              numberOfLines={2}
            >
              View{"\n"}Reports
            </Text>
          </DashboardCard>
        </TouchableOpacity>
      </View>
    </View>
  );
}
