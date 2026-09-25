import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";

/**
 * Minimal, quiet empty state for the Budget screen matching the Budgee design system:
 * - Clean dark icon container
 * - Off-white title and muted subtitle
 * - Solid Budgee gold CTA button
 */
const EmptyBudgetState = React.memo(function EmptyBudgetState({
  onSetup,
}: {
  onSetup?: () => void;
}) {
  return (
    <View
      style={{
        alignItems: "center",
        paddingVertical: 56,
        paddingHorizontal: 24,
      }}
    >
      <View
        style={{
          width: 50,
          height: 50,
          borderRadius: 16,
          backgroundColor: "#241E15",
          borderWidth: 1,
          borderColor: "#3D321F",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 16,
        }}
      >
        <Feather name="droplet" size={22} color="#D4AF6A" />
      </View>

      <Text
        style={{
          color: "#FFFFFF",
          fontSize: 18,
          fontWeight: "800",
          letterSpacing: -0.3,
          marginBottom: 6,
        }}
      >
        No budgets yet
      </Text>

      <Text
        style={{
          color: "#8E8E93",
          fontSize: 13.5,
          lineHeight: 20,
          textAlign: "center",
          maxWidth: 280,
          marginBottom: 20,
        }}
      >
        Set up this month&apos;s budgets in one tap, or create them one by one.
      </Text>

      {onSetup ? (
        <TouchableOpacity
          onPress={onSetup}
          activeOpacity={0.85}
          style={{
            backgroundColor: "#E8D595",
            paddingVertical: 12,
            paddingHorizontal: 28,
            borderRadius: 12,
            alignItems: "center",
          }}
        >
          <Text
            style={{
              color: "#111111",
              fontSize: 14.5,
              fontWeight: "700",
            }}
          >
            Set up my month
          </Text>
        </TouchableOpacity>
      ) : (
        <Text style={{ color: "#8E8E93", fontSize: 13, marginTop: 12 }}>
          Tap “New Budget” to get started.
        </Text>
      )}
    </View>
  );
});

export default EmptyBudgetState;
