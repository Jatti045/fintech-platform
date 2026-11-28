import React from "react";
import { Text, TouchableOpacity, View, StyleSheet } from "react-native";
import { BRAND } from "@/constants/ThemePalettes";
import SearchBar from "@/components/global/SearchBar";
import { Feather } from "@expo/vector-icons";
import { useAppDispatch, useAppSelector, useTheme } from "@/hooks/useRedux";
import { setMonthYear } from "@/store/slices/calendarSlice";
import MonthSelector from "@/components/home/MonthSelector";
import ScreenHeading from "@/components/global/ScreenHeading";

export interface BudgetHeaderProps {
  month: number;
  year?: number;
  showSearch: boolean;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSetup?: () => void;
  createAction?: React.ReactNode;
}
export default function BudgetHeader({
  month,
  year,
  showSearch,
  searchQuery,
  onSearchChange,
  onSetup,
  createAction,
}: BudgetHeaderProps) {
  const { THEME } = useTheme();
  const dispatch = useAppDispatch();
  const calendar = useAppSelector((state) => state?.calendar);
  const now = new Date();
  const displayYear = year ?? calendar?.year ?? now.getUTCFullYear();
  return (
    <View style={styles.header}>
      <ScreenHeading
        title="Budgets"
        accessory={
          <MonthSelector
            value={{ month, year: displayYear }}
            onChange={(value) => dispatch(setMonthYear(value))}
          />
        }
      />
      <View style={styles.tools}>
        {createAction}
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
      {showSearch && (
        <SearchBar
          placeholder="Search budgets"
          clearLabel="Clear budget search"
          searchQuery={searchQuery}
          setSearchQuery={onSearchChange}
        />
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  header: { marginBottom: BRAND.spacing.md, gap: BRAND.spacing.sm },
  tools: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: BRAND.spacing.sm,
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
