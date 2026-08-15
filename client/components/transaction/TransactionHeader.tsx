import React from "react";
import { Text, View } from "react-native";
import { useTheme } from "@/hooks/useRedux";
import SearchBar from "@/components/global/SearchBar";
import FlowHeader from "./FlowHeader";
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
}

/**
 * Fixed top content of the Transactions tab: title, the ledger readout
 * (FlowHeader), the search bar, and the category/amount filters. Pure
 * presentation — all state lives in `useTransactionScreen`.
 */
export default function TransactionHeader({
  displayTransactions,
  month,
  year,
  monthlyIncome,
  actualIncome,
  expectedIncome,
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

  return (
    <>
      {/* Screen title */}
      <View className="flex justify-center items-start mt-4 mb-2">
        <Text
          style={{ color: THEME.textPrimary }}
          className="text-2xl font-bold"
        >
          Transactions
        </Text>
      </View>

      {/* Ledger readout */}
      <FlowHeader
        transactions={displayTransactions}
        month={month}
        year={year}
        monthlyIncome={monthlyIncome}
        actualIncome={actualIncome}
        expectedIncome={expectedIncome}
        currencyCode={currencyCode}
      />

      {/* Search bar */}
      <SearchBar
        searchQuery={searchQuery}
        setSearchQuery={onSearchChange}
        placeholder="Search transactions..."
      />

      {/* Category + amount filters */}
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
    </>
  );
}
