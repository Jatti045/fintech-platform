import React from "react";
import { ScrollView, Text, TouchableOpacity } from "react-native";
import { useTheme, useUser } from "@/hooks/useRedux";
import { getCurrencySymbol } from "@/constants/Currencies";
import { BRAND } from "@/constants/ThemePalettes";
interface Props {
  selected: string;
  setSelected: (value: string) => void;
  disabled?: boolean;
}
export default function PresetChips({
  selected,
  setSelected,
  disabled,
}: Props) {
  const { THEME } = useTheme();
  const user = useUser();
  const symbol = getCurrencySymbol((user?.currency || "USD").toUpperCase());
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{
        paddingVertical: BRAND.spacing.sm,
        gap: BRAND.spacing.sm,
      }}
    >
      {[25, 50, 100, 200, 500].map((n) => {
        const active = String(selected) === String(n);
        return (
          <TouchableOpacity
            key={n}
            accessibilityRole="button"
            accessibilityLabel={`Set limit to ${symbol}${n}`}
            accessibilityState={{ selected: active, disabled: !!disabled }}
            disabled={disabled}
            onPress={() => setSelected(String(n))}
            style={{
              minHeight: BRAND.touchTarget,
              justifyContent: "center",
              paddingHorizontal: BRAND.spacing.md,
              borderRadius: BRAND.radius.input,
              borderWidth: 1,
              borderColor: THEME.border,
              backgroundColor: disabled
                ? THEME.disabledBackground
                : active
                  ? THEME.primary
                  : THEME.surface,
            }}
          >
            <Text
              style={{
                color: disabled
                  ? THEME.textDisabled
                  : active
                    ? THEME.onPrimary
                    : THEME.textSecondary,
                fontWeight: "600",
              }}
            >
              {symbol}
              {n}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}
