import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useRedux";

type Props = {
  /** Pre-formatted label, e.g. "August 2026". */
  monthLabel: string;
  /** Disables the forward arrow when already at the current month. */
  isCurrentMonth: boolean;
  onPrev: () => void;
  onNext: () => void;
};

/**
 * Centered month navigation row with understated controls.
 * Matches the reference design: [ < ]  Month Year  [ > ]
 */
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
        justifyContent: "center",
        marginBottom: 16,
      }}
    >
      <TouchableOpacity
        onPress={onPrev}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Previous month"
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          backgroundColor: THEME.surface,
          borderWidth: 1,
          borderColor: THEME.border,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Feather name="chevron-left" size={18} color={THEME.textPrimary} />
      </TouchableOpacity>

      <Text
        style={{
          color: THEME.textPrimary,
          fontSize: 15.5,
          fontWeight: "700",
          marginHorizontal: 16,
          letterSpacing: -0.2,
        }}
      >
        {monthLabel}
      </Text>

      <TouchableOpacity
        onPress={onNext}
        activeOpacity={isCurrentMonth ? 1 : 0.7}
        disabled={isCurrentMonth}
        accessibilityRole="button"
        accessibilityLabel="Next month"
        accessibilityState={{ disabled: isCurrentMonth }}
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          backgroundColor: THEME.surface,
          borderWidth: 1,
          borderColor: THEME.border,
          alignItems: "center",
          justifyContent: "center",
          opacity: isCurrentMonth ? 0.35 : 1,
        }}
      >
        <Feather name="chevron-right" size={18} color={THEME.textPrimary} />
      </TouchableOpacity>
    </View>
  );
}
