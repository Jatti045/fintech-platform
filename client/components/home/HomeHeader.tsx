import React from "react";
import { TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useRedux";
import { BRAND } from "@/constants/ThemePalettes";
import ScreenHeading from "@/components/global/ScreenHeading";
import MonthSelector from "./MonthSelector";
import type { CalendarState } from "@/types/calendar/types";

export default function HomeHeader({
  month,
  year,
  onMonthChange,
  onSettingsPress,
}: {
  month: number;
  year: number;
  onMonthChange: (value: CalendarState) => void;
  onSettingsPress: () => void;
}) {
  const { THEME } = useTheme();
  return (
    <View style={{ marginBottom: BRAND.spacing.md }}>
      <ScreenHeading
        title="Overview"
        accessory={
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              alignItems: "center",
              gap: BRAND.spacing.xs,
            }}
          >
            <MonthSelector value={{ month, year }} onChange={onMonthChange} />
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Profile settings"
              onPress={onSettingsPress}
              style={{
                width: BRAND.touchTarget,
                height: BRAND.touchTarget,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Feather name="settings" size={19} color={THEME.textSecondary} />
            </TouchableOpacity>
          </View>
        }
      />
    </View>
  );
}
