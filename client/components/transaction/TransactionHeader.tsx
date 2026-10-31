import React from "react";
import { Text, TextInput, TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useAppDispatch, useTheme } from "@/hooks/useRedux";
import { prevMonth, nextMonth } from "@/store/slices/calendarSlice";
import { BRAND } from "@/constants/ThemePalettes";
import MonthSelector from "@/components/home/MonthSelector";
import FilterTransaction from "./TxFilterOpt";
import type { ITransaction } from "@/types/transaction/types";
import type { IBudget } from "@/types/budget/types";

export interface TransactionHeaderProps {
  displayTransactions: ITransaction[];
  month: number;
  year: number;
  monthlyIncome: number;
  actualIncome: number;
  expectedIncome: number;
  currencyCode: string;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  budgets: IBudget[];
  filterCategoryId: string | "all";
  onFilterCategoryChange: (id: string | "all") => void;
  minAmount: string;
  onMinAmountChange: (amount: string) => void;
  maxAmount: string;
  onMaxAmountChange: (amount: string) => void;
  onClearFilters: () => void;
  onSearchPress?: () => void;
  onFilterPress?: () => void;
  onCalendarPress?: () => void;
}

export default function TransactionHeader({
  month,
  year,
  currencyCode,
  searchQuery,
  onSearchChange,
  budgets,
  filterCategoryId,
  onFilterCategoryChange,
  minAmount,
  onMinAmountChange,
  maxAmount,
  onMaxAmountChange,
  onClearFilters,
}: TransactionHeaderProps) {
  const { THEME } = useTheme();
  const dispatch = useAppDispatch();
  const now = new Date();
  const monthLabel = new Date(Date.UTC(year, month, 1)).toLocaleDateString(
    undefined,
    { month: "long", year: "numeric", timeZone: "UTC" },
  );
  return (
    <View style={{ paddingTop: BRAND.spacing.sm, gap: BRAND.spacing.md }}>
      <View>
        <Text
          accessibilityRole="header"
          style={{
            color: THEME.textPrimary,
            fontSize: 28,
            fontWeight: "700",
            letterSpacing: -0.8,
          }}
        >
          Transactions
        </Text>
        <Text
          style={{
            color: THEME.textSecondary,
            fontSize: 14,
            marginTop: BRAND.spacing.xs,
          }}
        >
          Your money, in detail · {currencyCode}
        </Text>
      </View>
      <MonthSelector
        monthLabel={monthLabel}
        isCurrentMonth={
          year === now.getUTCFullYear() && month === now.getUTCMonth()
        }
        onPrev={() => dispatch(prevMonth())}
        onNext={() => dispatch(nextMonth())}
      />
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: THEME.surface,
          borderWidth: 1,
          borderColor: THEME.border,
          borderRadius: BRAND.radius.input,
          paddingLeft: BRAND.spacing.md,
        }}
      >
        <Feather name="search" size={20} color={THEME.textSecondary} />
        <TextInput
          accessibilityLabel="Search transactions"
          placeholder="Search transactions..."
          placeholderTextColor={THEME.placeholderText}
          value={searchQuery}
          onChangeText={onSearchChange}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          selectionColor={THEME.primary}
          style={{
            flex: 1,
            minWidth: 0,
            minHeight: 52,
            color: THEME.textPrimary,
            fontSize: 15,
            paddingHorizontal: BRAND.spacing.sm,
            paddingVertical: BRAND.spacing.md,
          }}
        />
        {!!searchQuery && (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Clear search"
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
      <FilterTransaction
        budgets={budgets}
        filterCategoryId={filterCategoryId}
        setFilterCategoryId={onFilterCategoryChange}
        minAmount={minAmount}
        setMinAmount={onMinAmountChange}
        maxAmount={maxAmount}
        setMaxAmount={onMaxAmountChange}
        clearFilters={onClearFilters}
      />
    </View>
  );
}
