import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { BRAND, TYPE } from "@/constants/ThemePalettes";
import { useTheme } from "@/hooks/useRedux";
import { THEME_OPTIONS } from "@/utils/profile/profileService";
import type { ThemeSwitcherProps } from "@/types/profile/types";

const icons = { System: "smartphone", Light: "sun", Dark: "moon" } as const;

export default function ThemeSwitcher({
  selectedTheme,
  onThemeSelect,
}: ThemeSwitcherProps) {
  const { THEME } = useTheme();
  return (
    <View style={[styles.options, { backgroundColor: THEME.subtleSurface }]}>
      {THEME_OPTIONS.map(({ name }) => {
        const selected = selectedTheme === name;
        const color = selected ? THEME.textPrimary : THEME.textSecondary;
        return (
          <TouchableOpacity
            key={name}
            activeOpacity={0.75}
            onPress={() => onThemeSelect(name)}
            accessibilityRole="button"
            accessibilityLabel={`${name} theme`}
            accessibilityState={{ selected }}
            style={[
              styles.option,
              {
                backgroundColor: selected ? THEME.accentSurface : "transparent",
              },
            ]}
          >
            <Feather
              name={selected ? "check" : icons[name]}
              size={16}
              color={color}
            />
            <Text
              style={[
                TYPE.caption,
                { color, fontWeight: selected ? "700" : "500", flexShrink: 1 },
              ]}
            >
              {name}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  options: {
    borderRadius: BRAND.radius.input,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: BRAND.spacing.xs,
    padding: BRAND.spacing.xs,
  },
  option: {
    flexGrow: 1,
    flexBasis: 84,
    flexDirection: "row",
    gap: BRAND.spacing.xs,
    paddingHorizontal: BRAND.spacing.sm,
    alignItems: "center",
    justifyContent: "center",
    minHeight: BRAND.touchTarget,
    borderRadius: 7,
  },
});
