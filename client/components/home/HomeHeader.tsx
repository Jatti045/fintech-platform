import React from "react";
import { TouchableOpacity, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { BRAND, TYPE } from "@/constants/ThemePalettes";
import { useTheme } from "@/hooks/useRedux";
import MonthSelector from "./MonthSelector";
import type { CalendarState } from "@/types/calendar/types";

type Props = {
  onSettingsPress: () => void;
  month: number;
  year: number;
  onMonthChange: (value: CalendarState) => void;
};

export default function HomeHeader({
  onSettingsPress,
  month,
  year,
  onMonthChange,
}: Props) {
  const { THEME } = useTheme();

  return (
    <View style={styles.header}>
      <View style={styles.row}>
        <Text
          accessibilityRole="header"
          style={[TYPE.screen, styles.title, { color: THEME.textPrimary }]}
        >
          Overview
        </Text>
        <View style={styles.controls}>
          <MonthSelector value={{ month, year }} onChange={onMonthChange} />
          <TouchableOpacity
            onPress={onSettingsPress}
            accessibilityRole="button"
            accessibilityLabel="Profile settings"
            activeOpacity={0.75}
            style={[styles.settings, { backgroundColor: THEME.subtleSurface }]}
          >
            <Feather name="settings" size={19} color={THEME.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { gap: BRAND.spacing.sm, marginBottom: BRAND.spacing.md },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: BRAND.spacing.sm,
  },
  title: { flexShrink: 1 },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    gap: BRAND.spacing.sm,
    flexWrap: "wrap",
  },
  settings: {
    width: BRAND.touchTarget,
    minHeight: BRAND.touchTarget,
    borderRadius: BRAND.radius.button,
    alignItems: "center",
    justifyContent: "center",
  },
});
