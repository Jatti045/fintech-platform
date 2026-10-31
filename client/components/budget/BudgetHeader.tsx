import React from "react";
import { Text, TextInput, TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useAppDispatch, useAppSelector, useTheme } from "@/hooks/useRedux";
import { prevMonth, nextMonth } from "@/store/slices/calendarSlice";
import { BRAND } from "@/constants/ThemePalettes";
import NewBudgetButton from "./NewBudgetButton";
import MonthSelector from "@/components/home/MonthSelector";

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
    <View
      style={{
        paddingTop: BRAND.spacing.sm,
        gap: BRAND.spacing.md,
        marginBottom: BRAND.spacing.md,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          alignItems: "center",
          gap: BRAND.spacing.sm,
        }}
      >
        <View style={{ flexGrow: 1, flexBasis: 120 }}>
          <Text
            accessibilityRole="header"
            style={{
              color: THEME.textPrimary,
              fontSize: 28,
              fontWeight: "700",
              letterSpacing: -0.8,
            }}
          >
            Budgets
          </Text>
          <Text
            style={{
              color: THEME.textSecondary,
              fontSize: 14,
              marginTop: BRAND.spacing.xs,
            }}
          >
            Make room for what matters.
          </Text>
        </View>
        {onAddBudget && <NewBudgetButton inline onPress={onAddBudget} />}
      </View>
      {onMonthPress ? (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={`Select month, current is ${formattedMonth}`}
          onPress={onMonthPress}
          style={{ minHeight: BRAND.touchTarget, justifyContent: "center" }}
        >
          <Text style={{ color: THEME.primary, fontWeight: "600" }}>
            {formattedMonth}
          </Text>
        </TouchableOpacity>
      ) : (
        <MonthSelector
          monthLabel={formattedMonth}
          isCurrentMonth={
            displayYear === now.getUTCFullYear() &&
            (calendar?.month ?? now.getUTCMonth()) === now.getUTCMonth()
          }
          onPrev={() => dispatch(prevMonth())}
          onNext={() => dispatch(nextMonth())}
        />
      )}
      {onSetup && (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Smart Month Setup"
          onPress={onSetup}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: BRAND.spacing.md,
            padding: BRAND.spacing.md,
            backgroundColor: THEME.surface,
            borderRadius: BRAND.radius.card,
            borderWidth: 1,
            borderColor: THEME.border,
          }}
        >
          <View
            style={{
              backgroundColor: THEME.subtleSurface,
              width: 40,
              height: 40,
              borderRadius: 12,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Feather name="layers" size={20} color={THEME.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                color: THEME.textPrimary,
                fontSize: 15,
                fontWeight: "700",
              }}
            >
              Smart Month Setup
            </Text>
            <Text
              style={{
                color: THEME.textSecondary,
                fontSize: 12,
                lineHeight: 18,
                marginTop: 4,
              }}
            >
              Review prior limits and spending suggestions.
            </Text>
          </View>
          <Feather name="chevron-right" size={18} color={THEME.textSecondary} />
        </TouchableOpacity>
      )}
      {showSearch && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: THEME.surface,
            borderColor: THEME.border,
            borderWidth: 1,
            borderRadius: BRAND.radius.input,
            paddingLeft: BRAND.spacing.md,
          }}
        >
          <Feather name="search" size={20} color={THEME.textSecondary} />
          <TextInput
            accessibilityLabel="Search budgets"
            placeholder="Search budgets..."
            value={searchQuery}
            onChangeText={onSearchChange}
            autoCorrect={false}
            autoCapitalize="none"
            placeholderTextColor={THEME.placeholderText}
            selectionColor={THEME.primary}
            style={{
              flex: 1,
              minWidth: 0,
              minHeight: 52,
              color: THEME.textPrimary,
              fontSize: 15,
              padding: BRAND.spacing.md,
            }}
          />
          {!!searchQuery && (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Clear budget search"
              onPress={() => onSearchChange("")}
              style={{
                width: BRAND.touchTarget,
                minHeight: BRAND.touchTarget,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Feather name="x" size={20} color={THEME.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}
