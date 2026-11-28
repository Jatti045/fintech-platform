import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";

import { useTheme } from "@/hooks/useRedux";
import { getCurrencyByCode } from "@/constants/Currencies";
import type { CurrencySelectorProps } from "@/types/profile/types";

export default function CurrencySelector({
  userCurrency,
  onPress,
  disabled,
}: CurrencySelectorProps) {
  const { THEME } = useTheme();
  const code = userCurrency;
  const currency = getCurrencyByCode(code);

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={code ? `Default currency ${code}` : "Choose currency"}
      accessibilityState={{ disabled }}
      disabled={disabled}
      style={{ flexDirection: "row", alignItems: "center", minHeight: 56 }}
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
        <Feather name="globe" size={18} color={THEME.textSecondary} />
      </View>

      <View style={{ flex: 1 }}>
        <Text
          style={{
            color: THEME.textPrimary,
            fontSize: 15,
            fontWeight: "700",
          }}
        >
          Default currency
        </Text>
        <Text
          style={{
            color: THEME.textSecondary,
            fontSize: 12,
            marginTop: 2,
          }}
        >
          {code
            ? `${code} — ${currency?.name || "US Dollar"}`
            : "Choose currency"}
        </Text>
      </View>

      <Feather name="chevron-right" size={18} color={THEME.textSecondary} />
    </TouchableOpacity>
  );
}
