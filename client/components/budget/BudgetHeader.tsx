import React from "react";
import { Text, TouchableOpacity, View, StyleSheet } from "react-native";
import { BRAND, TYPE } from "@/constants/ThemePalettes";
import SearchBar from "@/components/global/SearchBar";
import { Feather } from "@expo/vector-icons";
import { useAppDispatch, useAppSelector, useTheme } from "@/hooks/useRedux";
import { setMonthYear } from "@/store/slices/calendarSlice";
import MonthPicker from "@/components/calendar/MonthPicker";

export interface BudgetHeaderProps {
  month: number;
  year?: number;
  showSearch: boolean;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSetup?: () => void;
}
export default function BudgetHeader({
  month,
  year,
  showSearch,
  searchQuery,
  onSearchChange,
  onSetup,
}: BudgetHeaderProps) {
  const { THEME } = useTheme();
  const dispatch = useAppDispatch();
  const calendar = useAppSelector((state) => state?.calendar);
  const now = new Date();
  const displayYear = year ?? calendar?.year ?? now.getUTCFullYear();
  return (
    <View style={styles.header}>
      <View style={styles.titleRow}>
        <Text
          accessibilityRole="header"
          style={[styles.title, { color: THEME.textPrimary }]}
        >
          Budgets
        </Text>
        <View style={{ flex: 1, minWidth: 0, maxWidth: 400 }}>
          <MonthPicker
            value={{ month, year: displayYear }}
            onChange={(value) => dispatch(setMonthYear(value))}
          />
        </View>
      </View>
      <View style={styles.tools}>
        {showSearch && (
          <SearchBar
            placeholder="Search budgets"
            clearLabel="Clear budget search"
            searchQuery={searchQuery}
            setSearchQuery={onSearchChange}
          />
        )}
        {onSetup && (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Smart Month Setup"
            onPress={onSetup}
            style={[styles.setup, { backgroundColor: THEME.subtleSurface }]}
          >
            <Feather name="layers" size={18} color={THEME.primary} />
            <Text
              style={{ color: THEME.primary, fontSize: 13, fontWeight: "600" }}
            >
              Month setup
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  header: { marginBottom: BRAND.spacing.sm },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  title: { ...TYPE.screen, flexShrink: 1, maxWidth: "60%" },
  tools: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: BRAND.spacing.sm,
    marginTop: BRAND.spacing.sm,
  },
  setup: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: BRAND.touchTarget,
    paddingHorizontal: 12,
    borderRadius: BRAND.radius.input,
  },
});
