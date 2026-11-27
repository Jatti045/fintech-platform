import React, { PropsWithChildren } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useRedux";
import { BRAND, TYPE } from "@/constants/ThemePalettes";

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
          minHeight: BRAND.touchTarget,
          gap: BRAND.spacing.sm,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderColor: THEME.border,
        }}
      >
        <Text
          accessibilityRole="header"
          style={[TYPE.section, { color: THEME.textPrimary, flexShrink: 1 }]}
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
              gap: BRAND.spacing.xs,
            }}
          >
            <Text
              style={[
                TYPE.caption,
                { color: THEME.primary, fontWeight: "600" },
              ]}
            >
              See all
            </Text>
            <Feather name="arrow-right" size={15} color={THEME.primary} />
          </TouchableOpacity>
        )}
      </View>
      {children}
    </View>
  );
}
