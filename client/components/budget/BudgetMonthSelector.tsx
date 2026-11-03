import React from "react";
import { Text, TouchableOpacity, View, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useRedux";
import { hexToRgba } from "@/utils/helper";

/** Budget's compact month control keeps the existing calendar actions. */
export default function BudgetMonthSelector({
  monthLabel,
  isCurrentMonth,
  onPrev,
  onNext,
  onMonthPress,
}: {
  monthLabel: string;
  isCurrentMonth: boolean;
  onPrev: () => void;
  onNext: () => void;
  onMonthPress?: () => void;
}) {
  const { THEME } = useTheme();
  const label = monthLabel.replace(
    /^(\S+) /,
    (_, month: string) => `${month.slice(0, 3)} `,
  );
  const month = (
    <Text
      style={{
        color: THEME.textPrimary,
        fontSize: 14,
        fontWeight: "700",
        textAlign: "center",
      }}
    >
      {label}
    </Text>
  );
  return (
    <View
      style={[
        styles.pill,
        {
          backgroundColor: THEME.surface,
          borderColor: hexToRgba(THEME.border, 0.35),
        },
      ]}
    >
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Previous month"
        onPress={onPrev}
        style={styles.arrow}
      >
        <Feather name="chevron-left" size={18} color={THEME.textPrimary} />
      </TouchableOpacity>
      {onMonthPress ? (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={`Select month, current is ${monthLabel}`}
          onPress={onMonthPress}
          style={styles.label}
        >
          {month}
          <Feather name="chevron-down" size={14} color={THEME.textPrimary} />
        </TouchableOpacity>
      ) : (
        <View accessibilityLabel={monthLabel} style={styles.label}>
          {month}
        </View>
      )}
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Next month"
        accessibilityState={{ disabled: isCurrentMonth }}
        disabled={isCurrentMonth}
        onPress={onNext}
        style={styles.arrow}
      >
        <Feather
          name="chevron-right"
          size={18}
          color={isCurrentMonth ? THEME.textDisabled : THEME.textPrimary}
        />
      </TouchableOpacity>
    </View>
  );
}
const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 18,
    borderWidth: 1,
    shadowColor: "#072B20",
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    shadowOpacity: 0.06,
    elevation: 2,
  },
  arrow: {
    width: 44,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    minHeight: 48,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    gap: 5,
    paddingHorizontal: 1,
  },
});
