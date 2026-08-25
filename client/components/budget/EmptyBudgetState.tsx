import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "@/hooks/useRedux";
import { hexToRgba } from "@/utils/helper";

/**
 * Minimal, quiet empty state for the Budget screen. A small icon and two
 * short lines communicate that no budgets exist yet, with a subtle pointer
 * to the create action. When `onSetup` is provided (user has history), it
 * surfaces Smart Month Setup as the primary action.
 */
const EmptyBudgetState = React.memo(function EmptyBudgetState({
  onSetup,
}: {
  onSetup?: () => void;
}) {
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
                Set up this month&apos;s budgets in one tap, or create them one by one.
      </Text>

      {onSetup ? (
        <TouchableOpacity onPress={onSetup} style={{ marginTop: 16 }} activeOpacity={0.9}>
          <LinearGradient
            colors={[THEME.primary, THEME.secondary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              paddingVertical: 12,
              paddingHorizontal: 24,
              borderRadius: 10,
              alignItems: "center",
            }}
          >
            <Text style={{ color: THEME.textPrimary, fontWeight: "700" }}>
              Set up my month
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      ) : (
        <Text style={{ color: THEME.textSecondary, fontSize: 12, marginTop: 14 }}>
          Tap “New Budget” to get started.
        </Text>
      )}
    </View>
  );
});

export default EmptyBudgetState;
