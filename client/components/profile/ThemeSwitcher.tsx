import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { THEME_OPTIONS } from "@/utils/profile/profileService";
import GlassPanel from "@/components/global/GlassPanel";
import { hexToRgba } from "@/utils/helper";
import type { ThemeSwitcherProps } from "@/types/profile/types";

/**
 * Renders the row of selectable theme swatches on a glass surface.
 */
export default function ThemeSwitcher({
  THEME,
  selectedTheme,
  onThemeSelect,
}: ThemeSwitcherProps) {
  return (
    <GlassPanel padding={14} radius={18} style={{ marginBottom: 12 }}>
      <Text
        style={{ color: THEME.textPrimary, fontSize: 15, fontWeight: "800", marginBottom: 12 }}
      >
        Appearance
      </Text>

      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        {THEME_OPTIONS.map((opt) => {
          const isActive = selectedTheme === opt.name;
          return (
            <TouchableOpacity
              key={opt.name}
              activeOpacity={0.85}
              onPress={() => onThemeSelect(opt.name)}
              accessibilityRole="button"
              accessibilityLabel={`${opt.name} theme`}
              accessibilityState={{ selected: isActive }}
              style={{
                alignItems: "center",
                paddingVertical: 8,
                borderRadius: 14,
                borderWidth: 2,
                borderColor: isActive ? THEME.primary : "transparent",
                backgroundColor: hexToRgba(THEME.surface, 0.4),
                paddingHorizontal: 10,
                flex: 1,
                marginHorizontal: 3,
              }}
            >
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  backgroundColor: opt.color,
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 6,
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.25)",
                }}
              >
                <Ionicons
                  name={(isActive ? "checkmark" : opt.icon) as any}
                  size={16}
                  color={isActive ? "#fff" : "rgba(255,255,255,0.9)"}
                />
              </View>
              <Text
                style={{
                  color: THEME.textPrimary,
                  fontWeight: isActive ? "800" : "600",
                  fontSize: 12,
                }}
              >
                {opt.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </GlassPanel>
  );
}
