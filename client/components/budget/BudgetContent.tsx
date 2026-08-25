import React from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { useTheme } from "@/hooks/useRedux";
import {
  BudgetHalo,
  BudgetReservoirRow,
  BudgetTrendCard,
  EmptyBudgetState,
} from "@/components/budget";
import SectionHeader from "@/components/global/SectionHeader";
import UnbudgetedBudgetSection from "./UnbudgetedBudgetSection";
import type { DisplayBudget, IBudget } from "@/types/budget/types";
import type { ITransaction } from "@/types/transaction/types";

export interface BudgetContentProps {
  isInitialLoading: boolean;
  hasBudgets: boolean;
  searchQuery: string;
  filteredBudgets: DisplayBudget[];
  budgetedBudgets: DisplayBudget[];
  unbudgetedBudgets: DisplayBudget[];
  selectedBudget?: DisplayBudget;
  monthLabel: string;
  activeCurrency: string;
  transactions: ITransaction[];
  month: number;
  year: number;
  onToggle: (budget: IBudget) => void;
  onEdit: (budget: IBudget) => void;
  onDelete: (id: string) => void;
  onSetLimit: (budget: IBudget) => void;
  /** Opens Smart Month Setup (empty state + unbudgeted section). */
  onSetup: () => void;
}

/**
 * Main body of the Budget tab. Owns the loading / empty / no-search-results /
 * content conditional and composes the existing budget primitives (Halo,
 * TrendCard, UnbudgetedBudgetSection, Reservoir rows). Pure presentation —
 * all data comes from `useBudgetScreen`.
 */
export default function BudgetContent({
  isInitialLoading,
  hasBudgets,
  searchQuery,
  filteredBudgets,
  budgetedBudgets,
  unbudgetedBudgets,
  selectedBudget,
  monthLabel,
  activeCurrency,
  transactions,
  month,
  year,
  onToggle,
  onEdit,
  onDelete,
  onSetLimit,
  onSetup,
}: BudgetContentProps) {
  const { THEME } = useTheme();

  if (isInitialLoading) {
    return (
      <View style={{ paddingVertical: 80, alignItems: "center" }}>
        <ActivityIndicator size="large" color={THEME.primary} />
      </View>
    );
  }

  if (!hasBudgets) {
    return <EmptyBudgetState onSetup={onSetup} />;
  }

  if (filteredBudgets.length === 0) {
    return (
      <View className="py-12 items-center">
        <Text style={{ color: THEME.textSecondary }}>
          No budgets match “{searchQuery}”
        </Text>
      </View>
    );
  }

  return (
    <>
      {/* Master dial */}
      <BudgetHalo
        budgets={filteredBudgets}
        monthLabel={monthLabel}
        currencyCode={activeCurrency}
      />

      {/* Channel oscilloscope — follows the selected budget */}
      {selectedBudget ? (
        <BudgetTrendCard
          key={selectedBudget.id}
          category={selectedBudget.category}
          budgetId={selectedBudget.id}
          displayLimit={selectedBudget.displayLimit}
          displaySpent={selectedBudget.displaySpent}
          currencyCode={selectedBudget.displayCurrency}
          transactions={transactions}
          month={month}
          year={year}
        />
      ) : null}

      {/* Unbudgeted / auto-created categories need a limit */}
      {unbudgetedBudgets.length > 0 && (
        <UnbudgetedBudgetSection
          budgets={unbudgetedBudgets}
          onSetLimit={onSetLimit}
          onUseSuggestions={onSetup}
        />
      )}

      {/* Reservoir channels */}
      <SectionHeader
        title="Channels"
        subtitle={`${budgetedBudgets.length}`}
        accent={THEME.primary}
      />
      {budgetedBudgets.map((budget) => (
        <BudgetReservoirRow
          key={budget.id}
          budget={budget}
          displayLimit={budget.displayLimit}
          displaySpent={budget.displaySpent}
          currencyCode={budget.displayCurrency}
          expanded={selectedBudget?.id === budget.id}
          onToggle={onToggle}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </>
  );
}
