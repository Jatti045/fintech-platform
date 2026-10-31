import BrandButton from "@/components/brand/BrandButton";
import BrandInput from "@/components/brand/BrandInput";
import { BRAND } from "@/constants/ThemePalettes";
import React from "react";
import { Text, View } from "react-native";
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

  actualIncome?: number | null;
  loading?: boolean;
  error?: boolean;
  currencyCode?: string;
}

/**
 * MonthlyIncome — card matching the approved mockup:
 * - Theme trend icon, "Monthly Income", "Set your expected monthly income as a planning baseline."
 * - Subtle dark green container showing "Recorded income · {monthLabel}" and actual amount.
 * - Dark numeric input with hairline border.
 * - Solid theme "Save Monthly Income" button.
 */
export default function MonthlyIncome({
  THEME: propTheme,
  input,
  monthLabel,
  setInput,
  saving,
  onSave,
  actualIncome = null,
  loading = false,
  error = false,
  currencyCode = "USD",
}: MonthlyIncomeProps) {
  const { THEME: reduxTheme } = useTheme();
  const theme = propTheme || reduxTheme;

  const expected = Number(input) || 0;
  const actual = actualIncome;

  const earnedText = actual == null
    ? loading ? "Loading recorded income…" : "Recorded income unavailable. Pull to refresh."
    : `${error ? "Cached income; refresh failed. " : ""}${formatCurrency(actual, currencyCode)}${expected > 0 ? ` of ${formatCurrency(expected, currencyCode)} expected` : " (no positive target)"}`;

  return (
    <View
      style={{
        backgroundColor: theme.surface,
        borderRadius: BRAND.radius.card,
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
          gap: 8,
        }}
      >
        <Text
          style={{
            color: theme.textSecondary,
            fontSize: 12.5,
            fontWeight: "500",
          }}
        >
          Recorded income · {monthLabel}
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

      <BrandInput label="Monthly income" value={input} onChangeText={setInput} keyboardType="decimal-pad" placeholder="0.00" editable={!saving && !loading} accessibilityLabel="Monthly income" />
      <View style={{ marginTop: 16 }}><BrandButton label="Save Monthly Income" loadingLabel="Saving…" loading={saving} disabled={loading} onPress={onSave} /></View>
    </View>
  );
}
