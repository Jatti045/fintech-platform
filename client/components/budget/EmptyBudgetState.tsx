import React from "react";
import { Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useRedux";
import { hexToRgba } from "@/utils/helper";

/**
 * Minimal, quiet empty state for the Budget screen. A small icon and two
 * short lines communicate that no budgets exist yet, with a subtle pointer
 * to the create action. Intentionally unobtrusive.
 */
const EmptyBudgetState = React.memo(function EmptyBudgetState() {
  const { THEME } = useTheme();

  return (
    <View
      style={{
        alignItems: "center",
        paddingVertical: 48,
        paddingHorizontal: 24,
      }}
    >
      <View
        style={{
          width: 46,
          height: 46,
          borderRadius: 15,
          backgroundColor: hexToRgba(THEME.primary, 0.1),
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 14,
        }}
      >
        <Feather name="droplet" size={20} color={THEME.primary} />
      </View>

      <Text
        style={{
          color: THEME.textPrimary,
          fontSize: 17,
          fontWeight: "800",
          marginBottom: 6,
        }}
      >
        No budgets yet
      </Text>

      <Text
        style={{
          color: THEME.textSecondary,
          fontSize: 13,
          lineHeight: 19,
          textAlign: "center",
          maxWidth: 260,
        }}
      >
        Create your first budget to track spending by category.
      </Text>

      <Text style={{ color: THEME.textSecondary, fontSize: 12, marginTop: 14 }}>
        Tap “New Budget” to get started.
      </Text>
    </View>
  );
});

export default EmptyBudgetState;
