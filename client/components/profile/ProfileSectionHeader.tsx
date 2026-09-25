import React from "react";
import { View, Text } from "react-native";

interface ProfileSectionHeaderProps {
  title: string;
  subtitle?: string;
}

/**
 * Reusable Section Header for the Profile screen matching the approved mockup:
 * —  TITLE  ──────────────────────  Subtitle
 *
 * Short gold dash, uppercase bold title, thin hairline divider, and subtle muted subtitle.
 */
export default function ProfileSectionHeader({
  title,
  subtitle,
}: ProfileSectionHeaderProps) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        marginTop: 22,
        marginBottom: 10,
      }}
    >
      {/* Gold indicator dash */}
      <View
        style={{
          width: 14,
          height: 2.5,
          backgroundColor: "#D4AF6A",
          borderRadius: 2,
          marginRight: 8,
        }}
      />

      {/* Bold uppercase title */}
      <Text
        style={{
          color: "#FFFFFF",
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
          backgroundColor: "#1F1F23",
          marginHorizontal: 10,
        }}
      />

      {/* Muted right-aligned subtitle */}
      {subtitle ? (
        <Text
          style={{
            color: "#8E8E93",
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
