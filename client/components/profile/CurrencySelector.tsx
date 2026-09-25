import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "@/hooks/useRedux";
import { getCurrencyByCode, DEFAULT_CURRENCY } from "@/constants/Currencies";
import type { CurrencySelectorProps } from "@/types/profile/types";

/**
 * Default Currency row matching the approved mockup:
 * Flag icon in rounded square, "Default Currency", subtitle "USD — US Dollar", chevron.
 */
export default function CurrencySelector({
  userCurrency,
  onPress,
}: CurrencySelectorProps) {
  const { THEME } = useTheme();
  const code = userCurrency || DEFAULT_CURRENCY;
  const currency = getCurrencyByCode(code);

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Default currency ${code}`}
      style={{ flexDirection: "row", alignItems: "center" }}
    >
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: 12,
          backgroundColor: THEME.surfaceHover,
          borderWidth: 1,
          borderColor: THEME.border,
          alignItems: "center",
          justifyContent: "center",
          marginRight: 12,
        }}
      >
        <Text style={{ fontSize: 18 }}>{currency?.flag || "🇺🇸"}</Text>
      </View>

      <View style={{ flex: 1 }}>
        <Text
          style={{
            color: THEME.textPrimary,
            fontSize: 15,
            fontWeight: "700",
          }}
        >
          Default Currency
        </Text>
        <Text
          style={{
            color: THEME.textSecondary,
            fontSize: 12,
            marginTop: 2,
          }}
        >
          {code} — {currency?.name || "US Dollar"}
        </Text>
      </View>

      <Ionicons name="chevron-forward" size={18} color={THEME.textSecondary} />
    </TouchableOpacity>
  );
}
