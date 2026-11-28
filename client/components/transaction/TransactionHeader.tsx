import React from "react";
import { Text, View } from "react-native";
import SearchBar from "@/components/global/SearchBar";
import { useAppDispatch, useTheme } from "@/hooks/useRedux";
import { setMonthYear } from "@/store/slices/calendarSlice";
import { BRAND, TYPE } from "@/constants/ThemePalettes";
import MonthSelector from "@/components/home/MonthSelector";
import ScreenHeading from "@/components/global/ScreenHeading";
import FilterTransaction from "./TxFilterOpt";
import type { ITransaction } from "@/types/transaction/types";

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
  createAction?: React.ReactNode;
}

export default function TransactionHeader({
  month,
  year,
  currencyCode,
  searchQuery,
  onSearchChange,
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
  createAction,
}: TransactionHeaderProps) {
  const { THEME } = useTheme();
  const dispatch = useAppDispatch();
  return (
    <View style={{ gap: BRAND.spacing.sm }}>
      <ScreenHeading
        title="Transactions"
        accessory={
          <MonthSelector
            value={{ month, year }}
            onChange={(value) => dispatch(setMonthYear(value))}
          />
        }
      />
      <View
        style={{
          flexDirection: "row",
          alignItems: "stretch",
          gap: BRAND.spacing.sm,
        }}
      >
        <SearchBar
          placeholder="Search transactions"
          searchQuery={searchQuery}
          setSearchQuery={onSearchChange}
        />
        {createAction}
      </View>
      <Text style={[TYPE.caption, { color: THEME.textSecondary }]}>
        Reporting currency · {currencyCode}
      </Text>
      <FilterTransaction
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
