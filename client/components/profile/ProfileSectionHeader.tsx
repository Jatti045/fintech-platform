import React from "react";
import { View, Text } from "react-native";
import { BRAND, TYPE } from "@/constants/ThemePalettes";
import { useTheme } from "@/hooks/useRedux";

export default function ProfileSectionHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  const { THEME } = useTheme();
  return (
    <View
      style={{ marginTop: BRAND.spacing.lg, marginBottom: BRAND.spacing.sm }}
    >
      <Text
        accessibilityRole="header"
        style={[TYPE.section, { color: THEME.textPrimary }]}
      >
        {title}
      </Text>
      {subtitle ? (
        <Text
          style={{ color: THEME.textSecondary, fontSize: 13, marginTop: 4 }}
        >
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}
