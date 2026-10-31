import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useRedux";
import { BRAND } from "@/constants/ThemePalettes";

type Props = {
  monthLabel: string;
  isCurrentMonth: boolean;
  onPrev: () => void;
  onNext: () => void;
};
export default function MonthSelector({
  monthLabel,
  isCurrentMonth,
  onPrev,
  onNext,
}: Props) {
  const { THEME } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: THEME.surface,
        borderWidth: 1,
        borderColor: THEME.border,
        borderRadius: BRAND.radius.input,
        marginBottom: BRAND.spacing.md,
      }}
    >
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Previous month"
        onPress={onPrev}
        style={{
          width: BRAND.touchTarget,
          minHeight: BRAND.touchTarget,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Feather name="chevron-left" size={20} color={THEME.textPrimary} />
      </TouchableOpacity>
      <View
        style={{
          flex: 1,
          alignItems: "center",
          paddingVertical: BRAND.spacing.sm,
        }}
      >
        <Text
          style={{
            color: THEME.textPrimary,
            textAlign: "center",
            fontSize: 15,
            fontWeight: "700",
          }}
        >
          {monthLabel}
        </Text>
        <Text
          style={{ color: THEME.textSecondary, fontSize: 12, marginTop: 2 }}
        >
          {isCurrentMonth ? "This month" : "Reporting period"}
        </Text>
      </View>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Next month"
        accessibilityState={{ disabled: isCurrentMonth }}
        disabled={isCurrentMonth}
        onPress={onNext}
        style={{
          width: BRAND.touchTarget,
          minHeight: BRAND.touchTarget,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Feather
          name="chevron-right"
          size={20}
          color={isCurrentMonth ? THEME.textDisabled : THEME.textPrimary}
        />
      </TouchableOpacity>
    </View>
  );
}
