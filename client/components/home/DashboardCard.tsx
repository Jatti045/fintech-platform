import React from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
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

export default function DashboardCard({
  children,
  style,
  radius = BRAND.radius.card,
  padding,
  paddingHorizontal = padding,
  paddingVertical = padding,
}: DashboardCardProps) {
  const { THEME } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: THEME.surface,
          borderRadius: radius,
          paddingHorizontal,
          paddingVertical,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
