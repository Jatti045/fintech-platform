import React, { useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useRedux";
import { formatCurrency } from "@/utils/helper";
import { useFinancialReport } from "@/hooks/reporting/useFinancialReport";
import ReportStatus from "@/components/reporting/ReportStatus";
import { BRAND } from "@/constants/ThemePalettes";
import BudgetHalo from "./BudgetHalo";
import BudgetIncomeSummary from "./BudgetIncomeSummary";
import BudgetReservoirRow from "./BudgetReservoirRow";
import UnbudgetedBudgetSection from "./UnbudgetedBudgetSection";
import EmptyBudgetState from "./EmptyBudgetState";
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
  onClearSearch?: () => void;
}

/** Monthly reporting values stay independent of the category search and row selection. */
export default function BudgetContent({
  searchQuery,
  selectedBudget,
  monthLabel,
  activeCurrency,
  month,
  year,
  onToggle,
  onEdit,
  onDelete,
  onSetLimit,
  onSetup,
  onClearSearch,
}: BudgetContentProps) {
  const [showAllCategories, setShowAllCategories] = useState(false);
  const reporting = useFinancialReport(month, year);
  const report = reporting.report;
  const { THEME } = useTheme();
  const isSearching = searchQuery.trim().length > 0;

  const status = (
    <ReportStatus
      report={report}
      loading={reporting.isFetching}
      error={reporting.error}
      stale={reporting.stale}
      onRetry={() => {
        void reporting.refetch();
      }}
    />
  );
  if (!report)
    return (
      <>
        {status}
        {reporting.isFetching && (
          <View
            accessible={false}
            style={{
              backgroundColor: THEME.surface,
              borderColor: THEME.border,
              borderWidth: 1,
              borderRadius: BRAND.radius.card,
              padding: BRAND.spacing.lg,
              gap: BRAND.spacing.md,
            }}
          >
            {["70%", "90%", "60%"].map((width) => (
              <View
                key={width}
                style={{
                  width: width as `${number}%`,
                  height: 20,
                  borderRadius: 8,
                  backgroundColor: THEME.surfaceHover,
                }}
              />
            ))}
          </View>
        )}
      </>
    );
  if (!report.budgets.length)
    return (
      <>
        {status}
        <EmptyBudgetState onSetup={onSetup} />
      </>
    );
  const allBudgets = report.budgets.map((b) => ({
    ...b,
    date: new Date(b.date),
    displayLimit: b.limit,
    displaySpent: b.spent,
    displayCurrency: report.currency,
  }));
  const matching = allBudgets.filter((b) =>
    b.category.toLowerCase().includes(searchQuery.trim().toLowerCase()),
  );
  const limited = matching.filter(
    (b) => !b.autoCreated && !(b.limit <= 0 && b.spent > 0),
  );
  const unbudgeted = matching.filter(
    (b) => b.autoCreated || (b.limit <= 0 && b.spent > 0),
  );
  const totalSpent = report.summary.netSpent;
  const totalLimit = report.budgets.reduce((sum, b) => sum + b.limit, 0);
  const monthlyIncome = report.summary.monthlyIncome;

  // Initial display limit: show 6 categories unless expanded or searching
  const categoriesToShow =
    showAllCategories || isSearching ? limited : limited.slice(0, 6);

  return (
    <>
      {status}
      {/* ── 1. Monthly summary ────────────────────────────────────── */}
      <BudgetHalo
        budgets={allBudgets}
        monthlySpent={totalSpent}
        monthLabel={monthLabel}
        year={year}
        currencyCode={report.currency}
      />

      {/* ── 2. Income context ────────────────────────── */}
      <BudgetIncomeSummary
        income={monthlyIncome}
        totalSpent={totalSpent}
        totalLimit={totalLimit}
        currencyCode={report.currency}
        onPressLimit={onSetup}
      />

      {/* ── 3. Categories Section Header ────────────────────────────────── */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: BRAND.spacing.sm,
          marginTop: 6,
          marginBottom: 10,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <View
            style={{
              width: 18,
              height: 3,
              borderRadius: 1.5,
              backgroundColor: THEME.primary,
              marginRight: 8,
            }}
          />
          <Text
            style={{
              color: THEME.textPrimary,
              fontSize: 14.5,
              fontWeight: "700",
              letterSpacing: 0.5,
              textTransform: "uppercase",
            }}
          >
            CATEGORIES
          </Text>
        </View>

        <Text
          style={{
            color: THEME.textSecondary,
            fontSize: 13,
            flexShrink: 1,
            maxWidth: "100%",
          }}
        >
          {isSearching
            ? "Matching categories spent"
            : "Total category spending"}{" "}
          <Text style={{ color: THEME.textPrimary, fontWeight: "700" }}>
            {formatCurrency(
              matching.reduce((sum, b) => sum + b.spent, 0),
              report.currency,
            )}
          </Text>
        </Text>
      </View>

      {!matching.length && (
        <View style={{ padding: BRAND.spacing.md, gap: BRAND.spacing.sm }}>
          <Text style={{ color: THEME.textSecondary }}>
            No budgets match “{searchQuery}”
          </Text>
          {onClearSearch && (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Clear budget search"
              onPress={onClearSearch}
              style={{ minHeight: BRAND.touchTarget, justifyContent: "center" }}
            >
              <Text style={{ color: THEME.primary, fontWeight: "600" }}>
                Clear search
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
      {/* ── Unified Categories List Container ───────────────────────────── */}
      {limited.length > 0 && (
        <View
          style={{
            backgroundColor: THEME.surface,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: THEME.border,
            overflow: "hidden",
            marginBottom: 14,
          }}
        >
          {categoriesToShow.map((budget, index) => {
            const isLast =
              index === categoriesToShow.length - 1 &&
              (limited.length <= 6 || showAllCategories || isSearching);

            return (
              <BudgetReservoirRow
                key={budget.id}
                budget={budget}
                displayLimit={budget.displayLimit}
                displaySpent={budget.displaySpent}
                remaining={budget.remaining}
                utilizationPercentage={budget.utilizationPercentage}
                currencyCode={budget.displayCurrency || activeCurrency}
                expanded={selectedBudget?.id === budget.id}
                isLast={isLast}
                onToggle={onToggle}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            );
          })}

          {/* "Show all categories >" expandable toggle */}
          {limited.length > 6 && !isSearching && (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={
                showAllCategories
                  ? "Show fewer categories"
                  : "Show all categories"
              }
              accessibilityState={{ expanded: showAllCategories }}
              activeOpacity={0.7}
              onPress={() => setShowAllCategories((prev) => !prev)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingHorizontal: 16,
                paddingVertical: 14,
                borderTopWidth: 1,
                borderTopColor: THEME.border,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Feather
                  name="list"
                  size={16}
                  color={THEME.textSecondary}
                  style={{ marginRight: 10 }}
                />
                <Text
                  style={{
                    color: THEME.textSecondary,
                    fontSize: 13.5,
                    fontWeight: "500",
                  }}
                >
                  {showAllCategories
                    ? "Show less"
                    : `Show all categories (${limited.length})`}
                </Text>
              </View>

              <Feather
                name={showAllCategories ? "chevron-up" : "chevron-right"}
                size={14}
                color={THEME.textSecondary}
              />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* ── 4. Lightweight Unbudgeted Spending Section ─────────────────── */}
      {unbudgeted.length > 0 && (
        <UnbudgetedBudgetSection
          budgets={unbudgeted}
          onSetLimit={onSetLimit}
          onUseSuggestions={onSetup}
        />
      )}
    </>
  );
}
