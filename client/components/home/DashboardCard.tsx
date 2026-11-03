import React from "react";
import { View, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { hexToRgba } from "@/utils/helper";
import { useTheme } from "@/hooks/useRedux";

export interface DashboardCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  radius?: number;
  padding?: number;
  paddingHorizontal?: number;
  paddingVertical?: number;
}

/**
 * Minimal, premium surface container.
 * Dynamically binds to the active theme's surface and border tokens.
 */
export default function DashboardCard({
  children,
  style,
  radius = 18,
  padding,
  paddingHorizontal,
  paddingVertical,
}: DashboardCardProps) {
  const { THEME } = useTheme();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: THEME.surface,
          borderColor: hexToRgba(THEME.border, 0.25),
          borderRadius: radius,
          padding: padding !== undefined ? padding : undefined,
          paddingHorizontal:
            paddingHorizontal !== undefined ? paddingHorizontal : padding,
          paddingVertical:
            paddingVertical !== undefined ? paddingVertical : padding,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    shadowColor: "#072B20",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
});
