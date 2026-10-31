import React, { PropsWithChildren } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { useTheme } from "@/hooks/useRedux";
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
    <View style={{ marginBottom: BRAND.spacing.lg }}>
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: BRAND.spacing.sm,
          marginBottom: BRAND.spacing.sm,
        }}
      >
        <Text
          accessibilityRole="header"
          style={{
            color: THEME.textPrimary,
            fontSize: 18,
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
            style={{ minHeight: BRAND.touchTarget, justifyContent: "center" }}
          >
            <Text
              style={{ color: THEME.primary, fontSize: 13, fontWeight: "700" }}
            >
              {action}
            </Text>
          </TouchableOpacity>
        )}
      </View>
      {children}
    </View>
  );
}
