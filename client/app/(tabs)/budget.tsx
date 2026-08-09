import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRefresh } from "@/hooks/useRefresh";
import {
  useBudgets,
  useTheme,
  useBudgetStatus,
  useCalendar,
  useTransactions,
  useUser,
} from "@/hooks/useRedux";
import { useAppDispatch } from "@/store";
import { fetchBudgets } from "@/store/slices/budgetSlice";
import {
  BudgetHalo,
  BudgetModal,
  BudgetReservoirRow,
  BudgetTrendCard,
  EmptyBudgetState,
  NewBudgetButton,
} from "@/components/budget";
import { useBudgetOperations } from "@/hooks/budget/useBudgetOperation";
import type { IBudget } from "@/types/budget/types";
import SearchBar from "@/components/global/SearchBar";
import SectionHeader from "@/components/global/SectionHeader";
import { useBudgetDisplayAmounts } from "@/hooks/budget/useBudgetDisplayAmounts";
import { hexToRgba } from "@/utils/helper";

// ─── Main Screen Component ──────────────────────────────────────────────────

export default function BudgetScreen() {
  // ── Redux selectors ─────────────────────────────────────────────────────
  const budgets = useBudgets();
  const transactions = useTransactions();
  const user = useUser();
  const activeCurrency = user?.currency || "USD";
  const { THEME } = useTheme();
  const { isLoading } = useBudgetStatus();
  const calendar = useCalendar();
  const dispatch = useAppDispatch();
  const { displayBudgets } = useBudgetDisplayAmounts(
    budgets,
    transactions,
    activeCurrency,
  );

  // Only the delete handler is needed at screen level;
  // create + update are fully managed inside BudgetModal.
  const { handleDeleteBudget } = useBudgetOperations();

  // ── Screen-level state ────────────────────────────────────────────────
  const [openSheet, setOpenSheet] = useState(false);
  const [editingBudget, setEditingBudget] = useState<IBudget | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  /** Budget whose drawer is expanded AND feeds the oscilloscope. */
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const isSearching = searchQuery.trim().length > 0;
  const isInitialLoading = isLoading && budgets.length === 0 && !isSearching;

  const { refreshing, onRefresh } = useRefresh(() =>
    dispatch(
      fetchBudgets({
        currentMonth: calendar.month,
        currentYear: calendar.year,
      }),
    ),
  );

  // ── Derived data ──────────────────────────────────────────────────────

  const filteredBudgets = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return displayBudgets;
    return displayBudgets.filter((b) =>
      (b.category ?? "").toLowerCase().includes(q),
    );
  }, [displayBudgets, searchQuery]);

  // Auto-select the first channel so the oscilloscope has a subject.
  useEffect(() => {
    if (
      filteredBudgets.length > 0 &&
      !filteredBudgets.some((b) => b.id === selectedId)
    ) {
      setSelectedId(filteredBudgets[0].id);
    }
  }, [filteredBudgets, selectedId]);

  const selectedBudget = useMemo(
    () =>
      filteredBudgets.find((b) => b.id === selectedId) ?? filteredBudgets[0],
    [filteredBudgets, selectedId],
  );

  const monthLabel = useMemo(
    () =>
      new Date(calendar.year, calendar.month, 1).toLocaleString(undefined, {
        month: "long",
      }),
    [calendar.year, calendar.month],
  );

  const hasBudgets = budgets.length > 0;

  // ── Stable callbacks ──────────────────────────────────────────────────

  const handleToggle = useCallback((budget: IBudget) => {
    setSelectedId(budget.id);
  }, []);

  const handleEditPress = useCallback((budget: IBudget) => {
    setEditingBudget(budget);
    setOpenSheet(true);
  }, []);

  const handleModalClose = useCallback(() => {
    setOpenSheet(false);
    setEditingBudget(null);
  }, []);

  const handleNewBudget = useCallback(() => {
    setOpenSheet(true);
  }, []);

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <SafeAreaView
      edges={["left", "right"]}
      className="flex-1"
      style={{ backgroundColor: THEME.background }}
    >
{/* Header */}
      <View style={{ paddingHorizontal: 16, paddingTop: 18 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 12,
          }}
        >
          <View>
            <Text
              className="text-2xl font-bold"
              style={{ color: THEME.textPrimary }}
            >
              Budgets
            </Text>
            <Text
              style={{ color: THEME.textSecondary, fontSize: 13, marginTop: 2 }}
            >
              Your monthly flow, one dial
            </Text>
          </View>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: hexToRgba(THEME.surface, 0.7),
              borderColor: THEME.border,
              borderWidth: 1,
              borderRadius: 999,
              paddingHorizontal: 12,
              paddingVertical: 6,
            }}
          >
            <Feather
              name="calendar"
              size={13}
              color={THEME.textSecondary}
              style={{ marginRight: 6 }}
            />
            <Text
              style={{ color: THEME.textPrimary, fontSize: 12, fontWeight: "700" }}
            >
              {monthLabel}
            </Text>
          </View>
        </View>

        {hasBudgets && (
          <SearchBar
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            placeholder="Search budgets..."
          />
        )}
      </View>

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
        {isInitialLoading ? (
          <View style={{ paddingVertical: 80, alignItems: "center" }}>
            <ActivityIndicator size="large" color={THEME.primary} />
          </View>
        ) : hasBudgets ? (
          filteredBudgets.length > 0 ? (
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
                  displayLimit={Number(
                    (selectedBudget as IBudget & { displayLimit?: number })
                      .displayLimit ?? selectedBudget.limit,
                  )}
                  displaySpent={Number(
                    (selectedBudget as IBudget & { displaySpent?: number })
                      .displaySpent ?? selectedBudget.spent,
                  )}
                  currencyCode={
                    (selectedBudget as IBudget & { displayCurrency?: string })
                      .displayCurrency || activeCurrency
                  }
                  transactions={transactions}
                  month={calendar.month}
                  year={calendar.year}
                />
              ) : null}

              {/* Reservoir channels */}
              <SectionHeader
                title="Channels"
                subtitle={`${filteredBudgets.length}`}
                accent={THEME.primary}
              />
              {filteredBudgets.map((budget) => (
                <BudgetReservoirRow
                  key={budget.id}
                  budget={budget}
                  displayLimit={Number(
                    (budget as IBudget & { displayLimit?: number })
                      .displayLimit ?? budget.limit,
                  )}
                  displaySpent={Number(
                    (budget as IBudget & { displaySpent?: number })
                      .displaySpent ?? budget.spent,
                  )}
                  currencyCode={
                    (budget as IBudget & { displayCurrency?: string })
                      .displayCurrency || activeCurrency
                  }
                  expanded={selectedId === budget.id}
                  onToggle={handleToggle}
                  onEdit={handleEditPress}
                  onDelete={handleDeleteBudget}
                />
              ))}
            </>
          ) : (
            <View className="py-12 items-center">
              <Text style={{ color: THEME.textSecondary }}>
                No budgets match “{searchQuery}”
              </Text>
            </View>
          )
        ) : (
          <EmptyBudgetState />
        )}
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
    </SafeAreaView>
  );
}