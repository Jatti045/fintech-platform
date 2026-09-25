import React from "react";
import { View, StyleSheet, type StyleProp, type ViewStyle } from "react-native";

export interface DashboardCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  radius?: number;
  padding?: number;
  paddingHorizontal?: number;
  paddingVertical?: number;
}

/**
 * Minimal, premium dark surface container.
 * Replaces glassmorphism with a tactile, restrained, physical dark surface.
 */
export default function DashboardCard({
  children,
  style,
  radius = 20,
  padding,
  paddingHorizontal,
  paddingVertical,
}: DashboardCardProps) {
  return (
    <View
      style={[
        styles.card,
        {
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
    backgroundColor: "#161618",
    borderWidth: 1,
    borderColor: "#232326",
    overflow: "hidden",
  },
});
