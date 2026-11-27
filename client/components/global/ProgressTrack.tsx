import React from "react";
import { View } from "react-native";
import { useTheme } from "@/hooks/useRedux";

export default function ProgressTrack({
  percent,
  label,
  description,
  color,
}: {
  percent: number;
  label?: string;
  description: string;
  color: string;
}) {
  const { THEME } = useTheme();
  const value = Math.max(0, Math.min(100, percent));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: value, text: description }}
      style={{
        height: 5,
        borderRadius: 3,
        backgroundColor: THEME.border,
        overflow: "hidden",
      }}
    >
      <View
        style={{
          height: 5,
          width: `${value}%`,
          backgroundColor: color,
          borderRadius: 3,
        }}
      />
    </View>
  );
}
