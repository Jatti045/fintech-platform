import React from "react";
import { RefreshControl, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@/hooks/useRedux";
import { useBudgetScreen } from "@/hooks/budget/useBudgetScreen";
import {
  BudgetContent,
  BudgetHeader,
  BudgetModal,
  MonthSetupModal,
  NewBudgetButton,
} from "@/components/budget";

/**
 * BudgetScreen is a composition/orchestration layer only:
 *
 *  - `useBudgetScreen` owns screen state (search/selection/modal), derived
 *    budget data, and refresh behavior
 *  - `BudgetHeader` / `BudgetContent` are presentational
 *  - `NewBudgetButton` is the create action
 *  - `BudgetModal` is self-contained (create/update via useBudgetOperations)
 */
export default function BudgetScreen() {
  const { THEME } = useTheme();

  const {
    searchQuery,
    setSearchQuery,
    isSearching,
    hasBudgets,
    isInitialLoading,
    refreshing,
    monthLabel,
    activeCurrency,
    openSheet,
    setOpenSheet,
    openSetup,
    editingBudget,
    transactions,
    month,
    year,
    filteredBudgets,
    budgetedBudgets,
    unbudgetedBudgets,
    selectedBudget,
    handleToggle,
    handleEditPress,
    handleNewBudget,
    handleModalClose,
    handleOpenSetup,
    handleCloseSetup,
    handleDeleteBudget,
    onRefresh,
  } = useBudgetScreen();

  return (
    <SafeAreaView
      edges={["left", "right"]}
      className="flex-1"
      style={{ backgroundColor: THEME.background }}
    >
      <BudgetHeader
        monthLabel={monthLabel}
        showSearch={hasBudgets}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: 120,
          paddingHorizontal: 16,
          paddingTop: 8,
        }}
        refreshControl={
          <RefreshControl
            refreshing={isSearching ? false : refreshing}
            onRefresh={onRefresh}
            progressBackgroundColor={THEME.background}
            colors={[THEME.primary]}
          />
        }
      >
        <BudgetContent
          isInitialLoading={isInitialLoading}
          hasBudgets={hasBudgets}
          searchQuery={searchQuery}
          filteredBudgets={filteredBudgets}
          budgetedBudgets={budgetedBudgets}
          unbudgetedBudgets={unbudgetedBudgets}
          selectedBudget={selectedBudget}
          monthLabel={monthLabel}
          activeCurrency={activeCurrency}
          transactions={transactions}
          month={month}
          year={year}
          onToggle={handleToggle}
          onEdit={handleEditPress}
          onDelete={handleDeleteBudget}
          onSetLimit={handleEditPress}
          onSetup={handleOpenSetup}
        />
      </ScrollView>

      {/* Floating action button */}
      <NewBudgetButton
        onPress={handleNewBudget}
        primary={THEME.primary}
        secondary={THEME.secondary}
        textPrimary={THEME.textPrimary}
      />

      {/* Create / Edit modal — self-contained via useBudgetOperations */}
      <BudgetModal
        openSheet={openSheet}
        setOpenSheet={setOpenSheet}
        editingBudget={editingBudget}
        onClose={handleModalClose}
      />

      {/* Smart Month Setup — shared flow for empty + unbudgeted states */}
      <MonthSetupModal
        open={openSetup}
        onOpenChange={handleCloseSetup}
        month={month}
        year={year}
        currencyCode={activeCurrency}
        monthLabel={monthLabel}
      />
    </SafeAreaView>
  );
}
