import React from "react";
import { Text, TextInput, TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { formatCurrency } from "@/utils/helper";
import type { ITheme } from "@/types/theme/types";

export interface MonthlyIncomeProps {
  THEME: ITheme;
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
 * - Gold trend icon, "Monthly Income", "Set your expected monthly income as a planning baseline."
 * - Subtle dark green container showing "Earned this month" and actual amount.
 * - Dark numeric input with hairline border.
 * - Gold "Save Monthly Income" button.
 */
export default function MonthlyIncome({
  input,
  setInput,
  saving,
  onSave,
  actualIncome = 0,
}: MonthlyIncomeProps) {
  const expected = Number(input) || 0;
  const actual = Number(actualIncome) || 0;

  const earnedText =
    expected > 0
      ? `${formatCurrency(actual, "USD")} of ${formatCurrency(expected, "USD")}`
      : `${formatCurrency(actual, "USD")} (no target set)`;

  return (
    <View
      style={{
        backgroundColor: "#141416",
        borderRadius: 20,
        borderWidth: 1,
        borderColor: "#1F1F23",
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
            backgroundColor: "rgba(212, 175, 106, 0.12)",
            borderWidth: 1,
            borderColor: "rgba(212, 175, 106, 0.25)",
            alignItems: "center",
            justifyContent: "center",
            marginRight: 12,
          }}
        >
          <Feather name="trending-up" size={17} color="#D4AF6A" />
        </View>

        <View style={{ flex: 1 }}>
          <Text
            style={{
              color: "#FFFFFF",
              fontSize: 15,
              fontWeight: "700",
            }}
          >
            Monthly Income
          </Text>
          <Text style={{ color: "#8E8E93", fontSize: 12, marginTop: 2 }}>
            Set your expected monthly income as a planning baseline.
          </Text>
        </View>
      </View>

      {/* Subtle green information container */}
      <View
        style={{
          backgroundColor: "rgba(52, 211, 153, 0.08)",
          borderWidth: 1,
          borderColor: "rgba(52, 211, 153, 0.2)",
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
        <Text style={{ color: "#8E8E93", fontSize: 12.5, fontWeight: "500" }}>
          Earned this month
        </Text>
        <Text
          style={{
            color: "#34D399",
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
        placeholderTextColor="#636366"
        style={{
          backgroundColor: "#101012",
          borderColor: "#222226",
          borderWidth: 1,
          color: "#FFFFFF",
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
          backgroundColor: saving ? "#262629" : "#D4AF6A",
          borderRadius: 12,
          paddingVertical: 13,
          alignItems: "center",
        }}
      >
        <Text
          style={{
            color: saving ? "#8E8E93" : "#0B0B0D",
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
