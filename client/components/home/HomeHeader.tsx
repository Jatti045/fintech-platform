import React from "react";
import { Image, View, Text, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useTheme, useUser } from "@/hooks/useRedux";
import { capitalizeFirst } from "@/utils/helper";
import { BRAND } from "@/constants/ThemePalettes";

type Props = { onInfoPress: () => void; onSettingsPress?: () => void };

export default function HomeHeader({ onInfoPress, onSettingsPress }: Props) {
  const user = useUser();
  const { THEME } = useTheme();
  const name = capitalizeFirst(String(user?.username || "").trim());
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: BRAND.spacing.sm,
        marginBottom: BRAND.spacing.lg,
      }}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: BRAND.spacing.sm,
            marginBottom: BRAND.spacing.sm,
          }}
        >
          <Image
            source={require("@/assets/fundleaf-brand-assets/logo-mark.png")}
            style={{ width: 26, height: 26 }}
            resizeMode="contain"
            accessible={false}
          />
          <Text
            style={{ color: THEME.primary, fontSize: 15, fontWeight: "700" }}
          >
            Fundleaf
          </Text>
        </View>
        <Text
          accessibilityRole="header"
          style={{
            color: THEME.textPrimary,
            fontSize: 25,
            fontWeight: "700",
            letterSpacing: -0.7,
          }}
        >
          {greeting}
          {name ? `, ${name}` : ""}
        </Text>
        <Text
          style={{
            color: THEME.textSecondary,
            fontSize: 14,
            marginTop: BRAND.spacing.xs,
          }}
        >
          Your month at a glance.
        </Text>
      </View>
      <View style={{ flexDirection: "row", gap: BRAND.spacing.xs }}>
        {(
          [
            ["info", "Help and usage", onInfoPress],
            [
              "settings",
              "Profile settings",
              onSettingsPress || (() => router.push("/(tabs)/profile")),
            ],
          ] as const
        ).map(([icon, label, onPress]) => (
          <TouchableOpacity
            key={label}
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={label}
            style={{
              width: BRAND.touchTarget,
              height: BRAND.touchTarget,
              borderRadius: BRAND.radius.input,
              backgroundColor: THEME.surface,
              borderWidth: 1,
              borderColor: THEME.border,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Feather name={icon} size={20} color={THEME.textSecondary} />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}
