import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "@/hooks/useRedux";
import { hexToRgba } from "@/utils/colorUtils";
import { THEME_OPTIONS } from "@/utils/profile/profileService";
import type { ThemeSwitcherProps } from "@/types/profile/types";

/**
 * Appearance row + 4 compact theme tiles matching the approved mockup:
 * - Palette icon, "Appearance", "Choose your preferred theme"
 * - 4 tiles: Light, Dark, Ember, Aurora
 * - Selected tile: theme primary border, theme surfaceHover background, primary circle with checkmark
 * - Unselected tiles: theme inputBackground surface, theme color icon
 */
export default function ThemeSwitcher({
  selectedTheme,
  onThemeSelect,
}: ThemeSwitcherProps) {
  const { selectedTheme: activeThemeName, THEME } = useTheme();
  const checkmarkColor = activeThemeName === "Light" ? "#FFFFFF" : "#0B0B0D";

  return (
    <View>
      {/* Header Row */}
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <View
          style={{
            width: 38,
            height: 38,
            borderRadius: 12,
            backgroundColor: hexToRgba(THEME.primary, 0.12),
            borderWidth: 1,
            borderColor: hexToRgba(THEME.primary, 0.25),
            alignItems: "center",
            justifyContent: "center",
            marginRight: 12,
          }}
        >
          <Ionicons name="color-palette" size={18} color={THEME.primary} />
        </View>

        <View style={{ flex: 1 }}>
          <Text
            style={{
              color: THEME.textPrimary,
              fontSize: 15,
              fontWeight: "700",
            }}
          >
            Appearance
          </Text>
          <Text
            style={{ color: THEME.textSecondary, fontSize: 12, marginTop: 2 }}
          >
            Choose your preferred theme
          </Text>
        </View>
      </View>

      {/* 4 Theme Option Tiles */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 8,
          marginTop: 14,
        }}
      >
        {THEME_OPTIONS.map((opt) => {
          const isActive = selectedTheme === opt.name;
          return (
            <TouchableOpacity
              key={opt.name}
              activeOpacity={0.8}
              onPress={() => onThemeSelect(opt.name)}
              accessibilityRole="button"
              accessibilityLabel={`${opt.name} theme`}
              accessibilityState={{ selected: isActive }}
              style={{
                alignItems: "center",
                paddingVertical: 10,
                paddingHorizontal: 4,
                borderRadius: 14,
                borderWidth: isActive ? 1.5 : 1,
                borderColor: isActive ? THEME.primary : THEME.border,
                backgroundColor: isActive
                  ? THEME.surfaceHover
                  : THEME.inputBackground,
                flex: 1,
              }}
            >
              {/* Icon Circle */}
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: isActive
                    ? THEME.primary
                    : hexToRgba(THEME.textSecondary, 0.08),
                  borderWidth: isActive ? 0 : 1,
                  borderColor: THEME.border,
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 6,
                }}
              >
                <Ionicons
                  name={isActive ? "checkmark" : (opt.icon as any)}
                  size={15}
                  color={isActive ? checkmarkColor : opt.color}
                />
              </View>

              {/* Theme Name */}
              <Text
                style={{
                  color: isActive ? THEME.textPrimary : THEME.textSecondary,
                  fontWeight: isActive ? "700" : "500",
                  fontSize: 12,
                }}
              >
                {opt.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}
