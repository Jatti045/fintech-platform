import React from "react";
import { View, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { BRAND } from "@/constants/ThemePalettes";
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
  radius = BRAND.radius.card,
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
          borderColor: THEME.border,
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
    overflow: "hidden",
  },
});
