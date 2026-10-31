import React from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BRAND } from "@/constants/ThemePalettes";
import { useTheme } from "@/hooks/useRedux";
import { useBudgetScreen } from "@/hooks/budget/useBudgetScreen";
import {
  BudgetContent,
  BudgetHeader,
  BudgetModal,
  MonthSetupModal,
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
      edges={["top", "left", "right"]}
      className="flex-1"
      style={{ backgroundColor: THEME.background }}
    >
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{
          paddingBottom: BRAND.spacing.xl,
          paddingHorizontal: 16,
          paddingTop: 8,
        }}
        refreshControl={
          <RefreshControl
            refreshing={isSearching ? false : refreshing}
            onRefresh={onRefresh}
            progressBackgroundColor={THEME.background}
            colors={[THEME.primary]}
            tintColor={THEME.primary}
          />
        }
      >
        <View style={{ width: "100%", maxWidth: 760, alignSelf: "center" }}>
          <BudgetHeader
            monthLabel={monthLabel}
            year={year}
            showSearch={hasBudgets}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onSetup={handleOpenSetup}
            onAddBudget={handleNewBudget}
          />
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
            onClearSearch={() => setSearchQuery("")}
          />
        </View>
      </ScrollView>

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
