import React from "react";
import { View, Text } from "react-native";
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
    <View style={{ marginTop: 24, marginBottom: 12 }}>
      <Text
        accessibilityRole="header"
        style={{ color: THEME.textPrimary, fontSize: 18, fontWeight: "700" }}
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
