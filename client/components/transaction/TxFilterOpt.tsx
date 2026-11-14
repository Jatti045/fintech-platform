import FundleafSheet from "@/components/sheets/FundleafSheet";
import React, { useMemo, useState } from "react";
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useRedux";
import { BRAND } from "@/constants/ThemePalettes";
import { capitalizeFirst } from "@/utils/helper";
import type { IBudget } from "@/types/budget/types";

interface Props {
  budgets: IBudget[];
  categories?: string[];
  categoriesLoading?: boolean;
  categoriesError?: boolean;
  onOpenCategories?: () => void;
  onRetryCategories?: () => void;
  filterCategoryId: string;
  setFilterCategoryId: (id: string) => void;
  minAmount: string;
  setMinAmount: (amount: string) => void;
  maxAmount: string;
  setMaxAmount: (amount: string) => void;
  clearFilters: () => void;
  onCalendarPress?: () => void;
}
export default function FilterTransaction({
  budgets,
  categories = [], categoriesLoading = false, categoriesError = false,
  onOpenCategories, onRetryCategories,
  filterCategoryId,
  setFilterCategoryId,
  minAmount,
  setMinAmount,
  maxAmount,
  setMaxAmount,
  clearFilters,
}: Props) {
  const { THEME } = useTheme();
  const [showMoreModal, setShowMoreModal] = useState(false);
  const [amountsOpen, setAmountsOpen] = useState(false);
  const amountActive = !!(minAmount || maxAmount);
  const active = filterCategoryId !== "all" || amountActive;
  const categorySelected = !["all", "income"].includes(filterCategoryId);
  const options = [
    { id: "all", label: "All", accessibility: "All categories" },
    { id: "income", label: "Income", accessibility: "Filter by Income" },
  ];
  const categoryOptions = useMemo(() => {
    const names = new Map<string, string>();
    for (const name of [...budgets.map((b) => b.category), ...categories]) {
      const label = name.trim();
      if (label) names.set(label.toLowerCase(), label);
    }
    return [
      { id: "all", category: "All Categories" },
      { id: "income", category: "All income" },
      { id: "transfer_out", category: "Transfers out" },
      { id: "transfer_in", category: "Transfers in" },
      ...[...names.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([key, category]) => ({
        id: `category:${key}`, category,
      })),
    ];
  }, [budgets, categories]);
  const chip = (selected: boolean) => ({
    minHeight: BRAND.touchTarget,
    paddingHorizontal: BRAND.spacing.md,
    borderRadius: BRAND.radius.input,
    borderWidth: 1,
    borderColor: selected ? THEME.primary : THEME.border,
    backgroundColor: selected ? THEME.subtleSurface : THEME.surface,
    justifyContent: "center" as const,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: BRAND.spacing.xs,
  });
  const renderOption = (option: (typeof options)[number]) => (
    <TouchableOpacity
      key={option.id}
      accessibilityRole="button"
      accessibilityLabel={option.accessibility}
      accessibilityState={{ selected: filterCategoryId === option.id }}
      onPress={() =>
        option.id === "all" ? clearFilters() : setFilterCategoryId(option.id)
      }
      style={chip(filterCategoryId === option.id)}
    >
      <Text
        numberOfLines={1}
        style={{
          color:
            filterCategoryId === option.id
              ? THEME.textPrimary
              : THEME.textSecondary,
          fontWeight: "600",
          fontSize: 13,
        }}
      >
        {option.label}
      </Text>
    </TouchableOpacity>
  );
  return (
    <View style={{ marginBottom: BRAND.spacing.sm }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: BRAND.spacing.sm }}>
        <View style={{ flexDirection: "row", gap: BRAND.spacing.sm }}>
          {options.map(renderOption)}
        </View>
        <View style={{ flexDirection: "row", gap: BRAND.spacing.sm }}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="More category filters"
          accessibilityState={{
            selected: categorySelected,
            expanded: showMoreModal,
          }}
          onPress={() => {
            onOpenCategories?.();
            setShowMoreModal(true);
          }}
          style={chip(categorySelected)}
        >
          <Text
            style={{
              color: categorySelected ? THEME.textPrimary : THEME.primary,
              fontSize: 13,
              fontWeight: "600",
            }}
          >
            Category
          </Text>
          <Feather name="chevron-down" size={16} color={THEME.primary} />
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Amount filters"
          accessibilityState={{ expanded: amountsOpen, selected: amountActive }}
          onPress={() => setAmountsOpen((v) => !v)}
          style={chip(amountActive)}
        >
          <Feather name="sliders" size={16} color={THEME.primary} />
          <Text
            style={{
              color: amountActive ? THEME.textPrimary : THEME.primary,
              fontSize: 13,
            }}
          >
            Amount{amountActive ? " · Active" : ""}
          </Text>
        </TouchableOpacity>
        </View>
      </View>
      <View style={{ alignItems: "flex-start" }}>
        {active && (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Clear filters"
            onPress={clearFilters}
            style={{
              minHeight: BRAND.touchTarget,
              justifyContent: "center",
              paddingHorizontal: BRAND.spacing.sm,
            }}
          >
            <Text
              style={{ color: THEME.primary, fontWeight: "600", fontSize: 13 }}
            >
              Reset filters
            </Text>
          </TouchableOpacity>
        )}
      </View>
      {(amountsOpen || amountActive) && (
        <View
          style={{
            flexDirection: "row",
            gap: BRAND.spacing.sm,
            marginTop: BRAND.spacing.sm,
          }}
        >
          {[
            {
              label: "Minimum amount",
              placeholder: "Min",
              value: minAmount,
              onChangeText: setMinAmount,
            },
            {
              label: "Maximum amount",
              placeholder: "Max",
              value: maxAmount,
              onChangeText: setMaxAmount,
            },
          ].map((input) => (
            <View key={input.label} style={{ flex: 1 }}>
              <Text
                style={{
                  color: THEME.textSecondary,
                  fontSize: 12,
                  marginBottom: BRAND.spacing.xs,
                }}
              >
                {input.label}
              </Text>
              <TextInput
                accessibilityLabel={input.label}
                placeholder={input.placeholder}
                keyboardType="decimal-pad"
                value={input.value}
                onChangeText={input.onChangeText}
                placeholderTextColor={THEME.placeholderText}
                selectionColor={THEME.primary}
                style={{
                  minHeight: 48,
                  backgroundColor: THEME.surface,
                  borderColor: THEME.border,
                  borderWidth: 1,
                  borderRadius: BRAND.radius.input,
                  color: THEME.textPrimary,
                  padding: BRAND.spacing.md,
                  fontSize: 15,
                }}
              />
            </View>
          ))}
        </View>
      )}
      <FundleafSheet
        visible={showMoreModal}
        onDismiss={() => setShowMoreModal(false)}
        title="Select category"
      >
        {categoriesLoading && <ActivityIndicator accessibilityLabel="Loading categories" color={THEME.primary} />}
        {categoriesError && <View style={{ gap: 8 }}>
          <Text accessibilityLiveRegion="polite" style={{ color: THEME.danger }}>Could not load all categories.</Text>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Retry categories" onPress={onRetryCategories} style={chip(false)}>
            <Text style={{ color: THEME.primary }}>Try again</Text>
          </TouchableOpacity>
        </View>}
        {!categoriesLoading && !categoriesError && categoryOptions.length === 4 &&
          <Text style={{ color: THEME.textSecondary }}>No categories for this month yet.</Text>}
        {categoryOptions.map(
          (option) => (
            <TouchableOpacity
              key={option.id}
              accessibilityRole="button"
              accessibilityLabel={`Select ${option.category}`}
              accessibilityState={{
                selected: filterCategoryId === option.id,
              }}
              onPress={() => {
                if (option.id === "all") clearFilters();
                else setFilterCategoryId(filterCategoryId === option.id ? "all" : option.id);
                setShowMoreModal(false);
              }}
              style={{
                minHeight: BRAND.touchTarget,
                flexDirection: "row",
                alignItems: "center",
                gap: BRAND.spacing.sm,
                paddingVertical: BRAND.spacing.sm,
                borderBottomWidth: 1,
                borderBottomColor: THEME.border,
              }}
            >
              <Text
                style={{
                  color:
                    filterCategoryId === option.id
                      ? THEME.primary
                      : THEME.textPrimary,
                  flex: 1,
                  fontSize: 15,
                }}
              >
                {capitalizeFirst(option.category)}
              </Text>
              {filterCategoryId === option.id && (
                <Feather name="check" size={18} color={THEME.primary} />
              )}
            </TouchableOpacity>
          ),
        )}
      </FundleafSheet>
    </View>
  );
}
