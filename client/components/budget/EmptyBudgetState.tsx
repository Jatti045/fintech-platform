import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useRedux";
import { hexToRgba } from "@/utils/colorUtils";

/**
 * Minimal, quiet empty state for the Budget screen matching the Budgee design system:
 * - Clean icon container with theme tint
 * - Primary title and muted subtitle
 * - Solid theme CTA button with high-contrast text
 */
const EmptyBudgetState = React.memo(function EmptyBudgetState({
  onSetup,
}: {
  onSetup?: () => void;
}) {
  const { selectedTheme, THEME } = useTheme();
  const ctaTextColor = selectedTheme === "Light" ? "#FFFFFF" : "#111113";

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
          backgroundColor: hexToRgba(THEME.primary, 0.15),
          borderWidth: 1,
          borderColor: hexToRgba(THEME.primary, 0.3),
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 16,
        }}
      >
        <Feather name="droplet" size={22} color={THEME.primary} />
      </View>

      <Text
        style={{
          color: THEME.textPrimary,
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
          color: THEME.textSecondary,
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
            backgroundColor: THEME.primary,
            paddingVertical: 12,
            paddingHorizontal: 28,
            borderRadius: 12,
            alignItems: "center",
          }}
        >
          <Text
            style={{
              color: ctaTextColor,
              fontSize: 14.5,
              fontWeight: "700",
            }}
          >
            Set up my month
          </Text>
        </TouchableOpacity>
      ) : (
        <Text
          style={{ color: THEME.textSecondary, fontSize: 13, marginTop: 12 }}
        >
          Tap “New Budget” to get started.
        </Text>
      )}
    </View>
  );
});

export default EmptyBudgetState;
