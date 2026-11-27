import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BRAND, TYPE } from "@/constants/ThemePalettes";
import { useTheme } from "@/hooks/useRedux";
import type { SettingsListProps } from "@/types/profile/types";

export default function SettingsList({ items }: SettingsListProps) {
  const { THEME } = useTheme();
  const orderedItems = [
    ...items.filter((item) => !item.isDestructive),
    ...items.filter((item) => item.isDestructive),
  ];
  return (
    <View
      style={{
        backgroundColor: THEME.surface,
        borderRadius: BRAND.radius.card,
        overflow: "hidden",
      }}
    >
      {orderedItems.map((item, index) => {
        const destructive =
          item.isDestructive || item.icon === "log-out-outline";
        const color = destructive ? THEME.danger : THEME.textPrimary;
        return (
          <TouchableOpacity
            key={`${item.title}-${item.icon}`}
            onPress={item.onPress}
            accessibilityRole="button"
            accessibilityLabel={item.title}
            activeOpacity={0.75}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: BRAND.spacing.md,
              minHeight: 52,
              paddingHorizontal: BRAND.spacing.md,
              paddingVertical: BRAND.spacing.sm,
              borderTopWidth: index ? StyleSheet.hairlineWidth : 0,
              borderColor: THEME.border,
            }}
          >
            <Ionicons
              name={item.icon as React.ComponentProps<typeof Ionicons>["name"]}
              size={19}
              color={color}
            />
            <Text style={[TYPE.label, { color, flex: 1 }]}>{item.title}</Text>
            <Ionicons
              name="chevron-forward"
              size={16}
              color={THEME.textSecondary}
            />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
