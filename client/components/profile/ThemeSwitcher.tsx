import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { THEME_OPTIONS } from "@/utils/profile/profileService";
import type { ThemeSwitcherProps } from "@/types/profile/types";

/**
 * Appearance row + 4 compact theme tiles matching the approved mockup:
 * - Palette icon, "Appearance", "Choose your preferred theme"
 * - 4 tiles: Light, Dark, Ember, Aurora
 * - Selected tile: warm gold border, dark background, gold circle with checkmark
 * - Unselected tiles: dark surface, theme color icon
 */
export default function ThemeSwitcher({
  selectedTheme,
  onThemeSelect,
}: ThemeSwitcherProps) {
  return (
    <View>
      {/* Header Row */}
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <View
          style={{
            width: 38,
            height: 38,
            borderRadius: 12,
            backgroundColor: "rgba(212, 175, 106, 0.12)",
            borderWidth: 1,
            borderColor: "rgba(212, 175, 106, 0.25)",
            alignItems: "center",
            justifyContent: "center",
            marginRight: 12,
          }}
        >
          <Ionicons name="color-palette" size={18} color="#D4AF6A" />
        </View>

        <View style={{ flex: 1 }}>
          <Text
            style={{
              color: "#FFFFFF",
              fontSize: 15,
              fontWeight: "700",
            }}
          >
            Appearance
          </Text>
          <Text style={{ color: "#8E8E93", fontSize: 12, marginTop: 2 }}>
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
                borderColor: isActive ? "#D4AF6A" : "#222226",
                backgroundColor: isActive ? "#1A1A1E" : "#161619",
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
                    ? "#D4AF6A"
                    : "rgba(255, 255, 255, 0.06)",
                  borderWidth: isActive ? 0 : 1,
                  borderColor: "rgba(255, 255, 255, 0.1)",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 6,
                }}
              >
                <Ionicons
                  name={isActive ? "checkmark" : (opt.icon as any)}
                  size={15}
                  color={isActive ? "#0B0B0D" : opt.color}
                />
              </View>

              {/* Theme Name */}
              <Text
                style={{
                  color: isActive ? "#FFFFFF" : "#8E8E93",
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
