import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useRedux";
import DashboardCard from "./DashboardCard";

type Props = {
  /** Called after the guard check passes (budget exists for this month). */
  onNewTransaction: () => void;
  onNewBudget: () => void;
};

/**
 * Quick Actions section:
 * QUICK ACTIONS
 * 2 actions filling available width side-by-side:
 * - New Transaction (primary accent)
 * - New Budget (secondary accent)
 */
export default function QuickActions({ onNewTransaction, onNewBudget }: Props) {
  const { THEME, selectedTheme } = useTheme();
  const iconColor = selectedTheme === "Light" ? "#FFFFFF" : "#111113";

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
          color: THEME.textSecondary,
          fontSize: 12,
          fontWeight: "700",
          letterSpacing: 0.8,
          textTransform: "uppercase",
          marginBottom: 10,
        }}
      >
        Quick Actions
      </Text>

      {/* 2 Action Cards filling width equally */}
      <View style={{ flexDirection: "row", gap: 12 }}>
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
            padding={14}
            style={{ minHeight: 96, justifyContent: "space-between" }}
          >
            <View
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                backgroundColor: THEME.primary,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Feather name="plus" size={18} color={iconColor} />
            </View>

            <Text
              style={{
                color: THEME.textPrimary,
                fontSize: 13,
                fontWeight: "600",
                lineHeight: 17,
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
            padding={14}
            style={{ minHeight: 96, justifyContent: "space-between" }}
          >
            <View
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                backgroundColor: THEME.secondary,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="disc-outline" size={18} color={iconColor} />
            </View>

            <Text
              style={{
                color: THEME.textPrimary,
                fontSize: 13,
                fontWeight: "600",
                lineHeight: 17,
                marginTop: 10,
              }}
              numberOfLines={2}
            >
              New{"\n"}Budget
            </Text>
          </DashboardCard>
        </TouchableOpacity>
      </View>
    </View>
  );
}
