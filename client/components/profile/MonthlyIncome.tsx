import React from "react";
import { Text, TextInput, TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useRedux";
import { formatCurrency, hexToRgba } from "@/utils/helper";
import GlassPanel from "@/components/global/GlassPanel";
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
 * MonthlyIncome — a glass inline editor for the month’s income. Feeds the
 * net-readings across Home and the Transaction flow header.
 */
export default function MonthlyIncome({
  THEME,
  input,
  setInput,
  monthLabel,
  saving,
  onSave,
  actualIncome = 0,
}: MonthlyIncomeProps) {
  const { THEME: T } = useTheme();
  const expected = Number(input) || 0;
  const actual = Number(actualIncome) || 0;
  return (
    <GlassPanel padding={14} radius={18} style={{ marginBottom: 16 }}>
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
        <View
          style={{
            width: 30,
            height: 30,
            borderRadius: 10,
            backgroundColor: hexToRgba(THEME.primary, 0.16),
            alignItems: "center",
            justifyContent: "center",
            marginRight: 10,
          }}
        >
          <Feather name="trending-up" size={15} color={THEME.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: THEME.textPrimary, fontSize: 15, fontWeight: "800" }}>
            Monthly Income
          </Text>
          <Text style={{ color: THEME.textSecondary, fontSize: 12, marginTop: 1 }}>
            {monthLabel}
          </Text>
        </View>
      </View>

      <Text style={{ color: THEME.textSecondary, fontSize: 12, marginBottom: 10 }}>
        Set your expected monthly income as a planning baseline.
      </Text>

      {/* Actual vs expected readout */}
      {actual > 0 && (
        <View
          style={{
            backgroundColor: hexToRgba(THEME.success, 0.1),
            borderRadius: 10,
            paddingHorizontal: 12,
            paddingVertical: 8,
            marginBottom: 10,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Text style={{ color: THEME.textSecondary, fontSize: 12, flex: 1 }}>
            Earned this month
          </Text>
          <Text
            style={{ color: THEME.success, fontSize: 13, fontWeight: "800" }}
          >
            {formatCurrency(actual, "USD")}
            {expected > 0
              ? ` of ${formatCurrency(expected, "USD")} expected`
              : " (no target set)"}
          </Text>
        </View>
      )}

      <TextInput
        value={input}
        onChangeText={setInput}
        keyboardType="decimal-pad"
        placeholder="0.00"
        placeholderTextColor={THEME.placeholderText}
        style={{
          backgroundColor: hexToRgba(THEME.background, 0.5),
          borderColor: THEME.border,
          borderWidth: 1,
          color: THEME.textPrimary,
          borderRadius: 12,
          paddingHorizontal: 14,
          paddingVertical: 12,
          fontSize: 16,
          fontWeight: "700",
          marginBottom: 10,
        }}
        accessibilityLabel="Monthly income"
      />

      <TouchableOpacity
        onPress={onSave}
        disabled={saving}
        accessibilityRole="button"
        accessibilityLabel="Save monthly income"
        style={{
          backgroundColor: saving ? THEME.border : THEME.primary,
          borderRadius: 12,
          paddingVertical: 12,
          alignItems: "center",
        }}
      >
        <Text style={{ color: T.textPrimary, fontWeight: "800", fontSize: 14 }}>
          {saving ? "Saving…" : "Save Monthly Income"}
        </Text>
      </TouchableOpacity>
    </GlassPanel>
  );
}