import React, { useMemo } from "react";
import { Animated, Text, TouchableOpacity } from "react-native";
import { useTheme } from "@/hooks/useRedux";
import { monthLabels } from "./months";

export default React.memo(function MonthItem({
  month,
  index,
  width,
  height,
  selected,
  scrollX,
  onSelect,
}: {
  month: number;
  index: number;
  width: number;
  height: number;
  selected: boolean;
  scrollX: Animated.Value;
  onSelect: (index: number) => void;
}) {
  const { THEME } = useTheme();
  const labels = useMemo(() => monthLabels(month), [month]);
  const range = [(index - 1) * width, index * width, (index + 1) * width];
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={`Select ${labels.full}`}
      accessibilityState={{ selected }}
      aria-selected={selected}
      onPress={() => onSelect(index)}
      activeOpacity={0.8}
      style={{ width, height, justifyContent: "center", alignItems: "center" }}
    >
      <Animated.View
        style={{
          alignItems: "center",
          opacity: scrollX.interpolate({
            inputRange: range,
            outputRange: [0.3, 1, 0.3],
            extrapolate: "clamp",
          }),
          transform: [
            {
              scale: scrollX.interpolate({
                inputRange: range,
                outputRange: [0.88, 1, 0.88],
                extrapolate: "clamp",
              }),
            },
          ],
        }}
      >
        <Text
          style={{
            color: selected ? THEME.primary : THEME.textPrimary,
            fontSize: 16,
            fontWeight: selected ? "700" : "500",
          }}
        >
          {labels.month}
        </Text>
        <Text
          style={{ color: THEME.textSecondary, fontSize: 11, marginTop: 2 }}
        >
          {labels.year}
        </Text>
      </Animated.View>
    </TouchableOpacity>
  );
});
