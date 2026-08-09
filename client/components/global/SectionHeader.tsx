import React from "react";
import { View, Text } from "react-native";
import { useTheme } from "@/hooks/useRedux";

export interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  /** Accent colour for the ornament line. Defaults to theme primary. */
  accent?: string;
}

/**
 * Eyebrow-style section divider: a short accent bar, an uppercase title,
 * then a hairline rule — used to frame the distinct zones on the redesigned
 * Budget and Goals screens.
 */
export default function SectionHeader({
  title,
  subtitle,
  accent,
}: SectionHeaderProps) {
  const { THEME } = useTheme();
  const color = accent ?? THEME.primary;

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        marginTop: 6,
        marginBottom: 12,
      }}
    >
      <View
        style={{
          width: 22,
          height: 2,
          borderRadius: 1,
          backgroundColor: color,
          marginRight: 10,
        }}
      />
      <Text
        style={{
          color: THEME.textPrimary,
          fontSize: 14,
          fontWeight: "800",
          letterSpacing: 0.4,
          textTransform: "uppercase",
        }}
      >
        {title}
      </Text>
      <View
        style={{
          flex: 1,
          height: 1,
          backgroundColor: THEME.border,
          marginLeft: 12,
        }}
      />
      {subtitle ? (
        <Text
          style={{ color: THEME.textSecondary, fontSize: 12, marginLeft: 8 }}
        >
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}