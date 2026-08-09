import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { getCurrencyByCode, DEFAULT_CURRENCY } from "@/constants/Currencies";
import GlassPanel from "@/components/global/GlassPanel";
import { hexToRgba } from "@/utils/helper";
import type { CurrencySelectorProps } from "@/types/profile/types";

/**
 * The row that displays the current currency and opens the picker modal.
 */
export default function CurrencySelector({
  THEME,
  userCurrency,
  onPress,
}: CurrencySelectorProps) {
  const code = userCurrency || DEFAULT_CURRENCY;
  const currency = getCurrencyByCode(code);

  return (
    <GlassPanel padding={14} radius={18} style={{ marginBottom: 12 }}>
      <TouchableOpacity
        activeOpacity={0.85}
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
            backgroundColor: hexToRgba(THEME.primary, 0.14),
            alignItems: "center",
            justifyContent: "center",
            marginRight: 12,
          }}
        >
          <Text style={{ fontSize: 18 }}>{currency?.flag}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: THEME.textPrimary, fontSize: 15, fontWeight: "800" }}>
            Default Currency
          </Text>
          <Text style={{ color: THEME.textSecondary, fontSize: 12, marginTop: 2 }}>
            {code} — {currency?.name}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={THEME.textSecondary} />
      </TouchableOpacity>
    </GlassPanel>
  );
}
