import React from "react";
import { Image, View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme, useUser } from "@/hooks/useRedux";
import { capitalizeFirst } from "@/utils/helper";
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
  const user = useUser();
  const name = capitalizeFirst(String(user?.username || "").trim());
  return (
    <View style={styles.header}>
      <View style={styles.brandRow}>
        <View style={styles.brand}>
          <Image
            source={require("@/assets/fundleaf-brand-assets/logo-mark.png")}
            style={styles.logo}
            resizeMode="contain"
            accessible={false}
          />
          <Text style={[styles.wordmark, { color: THEME.textPrimary }]}>
            Fundleaf
          </Text>
        </View>
        <TouchableOpacity
          onPress={onSettingsPress}
          accessibilityRole="button"
          accessibilityLabel="Profile settings"
          style={[styles.settings, { backgroundColor: THEME.subtleSurface }]}
        >
          <Feather name="settings" size={23} color={THEME.textPrimary} />
        </TouchableOpacity>
      </View>
      <View style={styles.welcomeRow}>
        <View style={styles.welcome}>
          <Text
            accessibilityRole="header"
            style={[styles.title, { color: THEME.textPrimary }]}
          >
            Welcome back{name ? `, ${name}` : ""}!
          </Text>
          <Text style={[styles.subtitle, { color: THEME.textSecondary }]}>
            Here’s your money at a glance.
          </Text>
        </View>
        <MonthSelector value={{ month, year }} onChange={onMonthChange} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { marginBottom: 22 },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 22,
  },
  brand: { flexDirection: "row", alignItems: "center", gap: 9, flexShrink: 1 },
  logo: { width: 30, height: 30 },
  wordmark: {
    fontSize: 27,
    fontWeight: "800",
    letterSpacing: -1.1,
    flexShrink: 1,
  },
  settings: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  welcomeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 10,
  },
  welcome: { flexGrow: 1, flexBasis: 180 },
  title: { fontSize: 21, fontWeight: "700", letterSpacing: -0.7 },
  subtitle: { fontSize: 13, lineHeight: 19, marginTop: 3 },
});
