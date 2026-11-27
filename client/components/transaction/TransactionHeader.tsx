import React from "react";
import { Text, View, useWindowDimensions } from "react-native";
import SearchBar from "@/components/global/SearchBar";
import { useAppDispatch, useTheme } from "@/hooks/useRedux";
import { setMonthYear } from "@/store/slices/calendarSlice";
import { BRAND, TYPE } from "@/constants/ThemePalettes";
import MonthPicker from "@/components/calendar/MonthPicker";
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
  categories?: string[];
  categoriesLoading?: boolean;
  categoriesError?: boolean;
  requestCategories?: () => void;
  retryCategories?: () => void;
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
  categories,
  categoriesLoading,
  categoriesError,
  requestCategories,
  retryCategories,
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
  const { width, fontScale } = useWindowDimensions();
  const stackMonth = width < 310 || fontScale > 1.3;
  return (
    <View style={{ paddingTop: BRAND.spacing.sm, gap: BRAND.spacing.md }}>
      <View>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            flexWrap: stackMonth ? "wrap" : "nowrap",
          }}
        >
          <Text
            accessibilityRole="header"
            style={{
              color: THEME.textPrimary,
              ...TYPE.screen,
              flexShrink: 1,
              maxWidth: stackMonth ? "100%" : "60%",
            }}
          >
            Transactions
          </Text>
          <View
            style={{
              flex: 1,
              minWidth: 0,
              maxWidth: 400,
              flexBasis: stackMonth ? "100%" : undefined,
            }}
          >
            <MonthPicker
              value={{ month, year }}
              onChange={(value) => dispatch(setMonthYear(value))}
            />
          </View>
        </View>
        <Text
          style={{
            color: THEME.textSecondary,
            fontSize: 14,
            marginTop: BRAND.spacing.xs,
          }}
        >
          Reporting currency · {currencyCode}
        </Text>
      </View>
      <SearchBar
        placeholder="Search transactions"
        searchQuery={searchQuery}
        setSearchQuery={onSearchChange}
      />
      <FilterTransaction
        budgets={budgets}
        categories={categories}
        categoriesLoading={categoriesLoading}
        categoriesError={categoriesError}
        onOpenCategories={requestCategories}
        onRetryCategories={retryCategories}
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
