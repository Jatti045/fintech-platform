import React from "react";
import { Text, TextInput, TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useRedux";
import { formatCurrency } from "@/utils/helper";
import { hexToRgba } from "@/utils/colorUtils";
import type { ITheme } from "@/types/theme/types";

export interface MonthlyIncomeProps {
  THEME?: ITheme;
  input: string;
  setInput: (value: string) => void;
  monthLabel: string;
  saving: boolean;
  onSave: () => void;
  /** Actual inflow (sum of INCOME transactions) for the selected month. */
  actualIncome?: number;
}

/**
 * MonthlyIncome — card matching the approved mockup:
 * - Theme trend icon, "Monthly Income", "Set your expected monthly income as a planning baseline."
 * - Subtle dark green container showing "Earned this month" and actual amount.
 * - Dark numeric input with hairline border.
 * - Solid theme "Save Monthly Income" button.
 */
export default function MonthlyIncome({
  THEME: propTheme,
  input,
  setInput,
  saving,
  onSave,
  actualIncome = 0,
}: MonthlyIncomeProps) {
  const { selectedTheme, THEME: reduxTheme } = useTheme();
  const theme = propTheme || reduxTheme;
  const saveBtnTextColor = selectedTheme === "Light" ? "#FFFFFF" : "#0B0B0D";

  const expected = Number(input) || 0;
  const actual = Number(actualIncome) || 0;

  const earnedText =
    expected > 0
      ? `${formatCurrency(actual, "USD")} of ${formatCurrency(expected, "USD")}`
      : `${formatCurrency(actual, "USD")} (no target set)`;

  return (
    <View
      style={{
        backgroundColor: theme.surface,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: theme.border,
        padding: 16,
        marginBottom: 8,
      }}
    >
      {/* Header Row */}
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <View
          style={{
            width: 38,
            height: 38,
            borderRadius: 12,
            backgroundColor: hexToRgba(theme.primary, 0.12),
            borderWidth: 1,
            borderColor: hexToRgba(theme.primary, 0.25),
            alignItems: "center",
            justifyContent: "center",
            marginRight: 12,
          }}
        >
          <Feather name="trending-up" size={17} color={theme.primary} />
        </View>

        <View style={{ flex: 1 }}>
          <Text
            style={{
              color: theme.textPrimary,
              fontSize: 15,
              fontWeight: "700",
            }}
          >
            Monthly Income
          </Text>
          <Text
            style={{ color: theme.textSecondary, fontSize: 12, marginTop: 2 }}
          >
            Set your expected monthly income as a planning baseline.
          </Text>
        </View>
      </View>

      {/* Subtle green information container */}
      <View
        style={{
          backgroundColor: hexToRgba(theme.success, 0.12),
          borderWidth: 1,
          borderColor: hexToRgba(theme.success, 0.25),
          borderRadius: 12,
          paddingHorizontal: 14,
          paddingVertical: 10,
          marginTop: 14,
          marginBottom: 12,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Text
          style={{
            color: theme.textSecondary,
            fontSize: 12.5,
            fontWeight: "500",
          }}
        >
          Earned this month
        </Text>
        <Text
          style={{
            color: theme.success,
            fontSize: 13,
            fontWeight: "700",
            letterSpacing: -0.1,
          }}
        >
          {earnedText}
        </Text>
      </View>

      {/* Numeric Input */}
      <TextInput
        value={input}
        onChangeText={setInput}
        keyboardType="decimal-pad"
        placeholder="0.00"
        placeholderTextColor={theme.placeholderText}
        style={{
          backgroundColor: theme.inputBackground,
          borderColor: theme.border,
          borderWidth: 1,
          color: theme.textPrimary,
          borderRadius: 12,
          paddingHorizontal: 14,
          paddingVertical: 12,
          fontSize: 16,
          fontWeight: "700",
          marginBottom: 10,
        }}
        accessibilityLabel="Monthly income"
      />

      {/* Save Button */}
      <TouchableOpacity
        onPress={onSave}
        disabled={saving}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="Save monthly income"
        style={{
          backgroundColor: saving ? theme.surfaceHover : theme.primary,
          borderRadius: 12,
          paddingVertical: 13,
          alignItems: "center",
        }}
      >
        <Text
          style={{
            color: saving ? theme.textSecondary : saveBtnTextColor,
            fontWeight: "800",
            fontSize: 14,
          }}
        >
          {saving ? "Saving…" : "Save Monthly Income"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
