import React, { PropsWithChildren } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { useTheme } from "@/hooks/useRedux";
import { Feather } from "@expo/vector-icons";
import DashboardCard from "./DashboardCard";
import { BRAND } from "@/constants/ThemePalettes";

export default function DashboardSection({
  title,
  action,
  onPress,
  children,
}: PropsWithChildren<{
  title: string;
  action?: string;
  onPress?: () => void;
}>) {
  const { THEME } = useTheme();
  return (
    <DashboardCard
      paddingHorizontal={14}
      paddingVertical={8}
      style={{ marginBottom: 14 }}
    >
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: BRAND.spacing.sm,
          marginBottom: 0,
        }}
      >
        <Text
          accessibilityRole="header"
          style={{
            color: THEME.textPrimary,
            fontSize: 17,
            fontWeight: "700",
            letterSpacing: -0.4,
          }}
        >
          {title}
        </Text>
        {action && onPress && (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={action}
            onPress={onPress}
            style={{
              minHeight: BRAND.touchTarget,
              flexDirection: "row",
              alignItems: "center",
              gap: 3,
            }}
          >
            <Text
              style={{ color: THEME.primary, fontSize: 13, fontWeight: "700" }}
            >
              See All
            </Text>
            <Feather name="chevron-right" size={18} color={THEME.primary} />
          </TouchableOpacity>
        )}
      </View>
      {children}
    </DashboardCard>
  );
}
