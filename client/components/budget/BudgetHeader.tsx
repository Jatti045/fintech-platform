import React from "react";
import {
  Image,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  StyleSheet,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useAppDispatch, useAppSelector, useTheme } from "@/hooks/useRedux";
import { prevMonth, nextMonth } from "@/store/slices/calendarSlice";
import NewBudgetButton from "./NewBudgetButton";
import BudgetMonthSelector from "./BudgetMonthSelector";

export interface BudgetHeaderProps {
  monthLabel: string;
  year?: number;
  showSearch: boolean;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onMonthPress?: () => void;
  onSetup?: () => void;
  onAddBudget?: () => void;
}
export default function BudgetHeader({
  monthLabel,
  year,
  showSearch,
  searchQuery,
  onSearchChange,
  onMonthPress,
  onSetup,
  onAddBudget,
}: BudgetHeaderProps) {
  const { THEME } = useTheme();
  const dispatch = useAppDispatch();
  const calendar = useAppSelector((state) => state?.calendar);
  const now = new Date();
  const displayYear = year ?? calendar?.year ?? now.getUTCFullYear();
  const formattedMonth = monthLabel.includes(String(displayYear))
    ? monthLabel
    : `${monthLabel} ${displayYear}`;
  return (
    <View style={styles.header}>
      <View style={styles.brandRow}>
        <View style={styles.brand}>
          <Image
            source={require("@/assets/fundleaf-brand-assets/logo-mark.png")}
            style={{ width: 30, height: 30 }}
            resizeMode="contain"
            accessible={false}
          />
          <Text style={[styles.wordmark, { color: THEME.textPrimary }]}>
            Fundleaf
          </Text>
        </View>
        {onAddBudget && <NewBudgetButton inline onPress={onAddBudget} />}
      </View>
      <View style={styles.titleRow}>
        <Text
          accessibilityRole="header"
          style={[styles.title, { color: THEME.textPrimary }]}
        >
          Budgets
        </Text>
        <BudgetMonthSelector
          monthLabel={formattedMonth}
          isCurrentMonth={
            displayYear === now.getUTCFullYear() &&
            (calendar?.month ?? now.getUTCMonth()) === now.getUTCMonth()
          }
          onPrev={() => dispatch(prevMonth())}
          onNext={() => dispatch(nextMonth())}
          onMonthPress={onMonthPress}
        />
      </View>
      <Text style={[styles.subtitle, { color: THEME.textSecondary }]}>
        Plan, track and stay in control of your spending.
      </Text>
      <View style={styles.tools}>
        {showSearch && (
          <View
            style={[
              styles.search,
              { backgroundColor: THEME.surface, borderColor: THEME.border },
            ]}
          >
            <Feather name="search" size={17} color={THEME.textSecondary} />
            <TextInput
              accessibilityLabel="Search budgets"
              placeholder="Search budgets..."
              value={searchQuery}
              onChangeText={onSearchChange}
              autoCorrect={false}
              autoCapitalize="none"
              placeholderTextColor={THEME.placeholderText}
              selectionColor={THEME.primary}
              style={[styles.input, { color: THEME.textPrimary }]}
            />
            {!!searchQuery && (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Clear budget search"
                onPress={() => onSearchChange("")}
                style={styles.clear}
              >
                <Feather name="x" size={18} color={THEME.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
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
  header: { marginBottom: 18 },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    marginBottom: 20,
  },
  brand: { flexDirection: "row", alignItems: "center", gap: 8 },
  wordmark: { fontSize: 26, fontWeight: "800", letterSpacing: -1 },
  titleRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  title: { fontSize: 32, fontWeight: "800", letterSpacing: -1 },
  subtitle: { fontSize: 13, lineHeight: 20, marginTop: 5, marginBottom: 14 },
  tools: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
  },
  search: {
    flex: 1,
    minWidth: 140,
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 14,
    paddingLeft: 12,
  },
  input: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    paddingHorizontal: 10,
    fontSize: 13,
  },
  clear: {
    width: 44,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  setup: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 48,
    paddingHorizontal: 12,
    borderRadius: 14,
  },
});
