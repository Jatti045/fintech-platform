import React from "react";
import { View, Text } from "react-native";
import { useTheme } from "@/hooks/useRedux";

interface ProfileSectionHeaderProps {
  title: string;
  subtitle?: string;
}

/**
 * Reusable Section Header for the Profile screen matching the approved mockup:
 * —  TITLE  ──────────────────────  Subtitle
 *
 * Short theme accent dash, uppercase bold title, thin hairline divider, and subtle muted subtitle.
 */
export default function ProfileSectionHeader({
  title,
  subtitle,
}: ProfileSectionHeaderProps) {
  const { THEME } = useTheme();

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        marginTop: 22,
        marginBottom: 10,
      }}
    >
      {/* Accent indicator dash */}
      <View
        style={{
          width: 14,
          height: 2.5,
          backgroundColor: THEME.primary,
          borderRadius: 2,
          marginRight: 8,
        }}
      />

      {/* Bold uppercase title */}
      <Text
        style={{
          color: THEME.textPrimary,
          fontSize: 12.5,
          fontWeight: "800",
          letterSpacing: 0.8,
          textTransform: "uppercase",
        }}
      >
        {title}
      </Text>

      {/* Hairline horizontal divider */}
      <View
        style={{
          flex: 1,
          height: 1,
          backgroundColor: THEME.border,
          marginHorizontal: 10,
        }}
      />

      {/* Muted right-aligned subtitle */}
      {subtitle ? (
        <Text
          style={{
            color: THEME.textSecondary,
            fontSize: 11.5,
            fontWeight: "500",
          }}
        >
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}
