import FundleafSheet from "@/components/sheets/FundleafSheet";
import React from "react";
import { Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "@/hooks/useRedux";
import { CURRENCIES, DEFAULT_CURRENCY } from "@/constants/Currencies";
import type { CurrencyPickerModalProps } from "@/types/profile/types";

/**
 * Bottom-sheet style modal for selecting the default currency.
 * Minimal, theme-aware, restrained design.
 */
export default function CurrencyPickerModal({
  visible,
  userCurrency,
  onSelect,
  onClose,
}: CurrencyPickerModalProps) {
  const { THEME } = useTheme();

  return (
    <FundleafSheet
      visible={visible}
      onDismiss={onClose}
      title="Select Default Currency"
    >
      {CURRENCIES.map((item) => {
        const isSelected = item.code === (userCurrency || DEFAULT_CURRENCY);
        return (
          <TouchableOpacity
            key={item.code}
            onPress={() => onSelect(item.code)}
            accessibilityRole="button"
            accessibilityLabel={`${item.code} — ${item.name}`}
            accessibilityState={{ selected: isSelected }}
            style={{
              minHeight: 56,
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              paddingVertical: 12,
              borderBottomWidth: 1,
              borderBottomColor: THEME.border,
              backgroundColor: isSelected ? THEME.subtleSurface : THEME.surface,
            }}
          >
            <Text style={{ fontSize: 22 }}>{item.flag}</Text>
            <Text style={{ flex: 1, color: THEME.textPrimary, fontSize: 15 }}>
              {item.code} — {item.name}
            </Text>
            <Text style={{ color: THEME.textSecondary }}>{item.symbol}</Text>
            {isSelected ? (
              <Ionicons
                name="checkmark-circle"
                size={20}
                color={THEME.primary}
              />
            ) : null}
          </TouchableOpacity>
        );
      })}
    </FundleafSheet>
  );
}
