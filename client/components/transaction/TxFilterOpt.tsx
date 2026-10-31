import { ScrollView } from "react-native-gesture-handler";
import FundleafSheet from "@/components/sheets/FundleafSheet";
import React, { useState } from "react";
import { Text, TextInput, TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useRedux";
import { BRAND } from "@/constants/ThemePalettes";
import { capitalizeFirst } from "@/utils/helper";
import type { IBudget } from "@/types/budget/types";

interface Props {
  budgets: IBudget[];
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
  const categorySelected = ![
    "all",
    "income",
    "transfer_out",
    "transfer_in",
  ].includes(filterCategoryId);
  const options = [
    { id: "all", label: "All", accessibility: "All categories" },
    { id: "income", label: "Income", accessibility: "Filter by Income" },
    {
      id: "transfer_out",
      label: "Transfer out",
      accessibility: "Filter by Transfer out",
    },
    {
      id: "transfer_in",
      label: "Transfer in",
      accessibility: "Filter by Transfer in",
    },
    ...budgets.map((b) => ({
      id: b.id,
      label: capitalizeFirst(b.category),
      accessibility: `Filter by ${b.category}`,
    })),
  ];
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
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          gap: BRAND.spacing.sm,
          paddingBottom: BRAND.spacing.sm,
        }}
      >
        {options.slice(0, 4).map(renderOption)}
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="More category filters"
          accessibilityState={{
            selected: categorySelected,
            expanded: showMoreModal,
          }}
          onPress={() => setShowMoreModal(true)}
          style={chip(categorySelected)}
        >
          <Text
            style={{
              color: categorySelected ? THEME.textPrimary : THEME.primary,
              fontSize: 13,
              fontWeight: "600",
            }}
          >
            Categories
          </Text>
          <Feather name="chevron-down" size={16} color={THEME.primary} />
        </TouchableOpacity>
        {options.slice(4).map(renderOption)}
      </ScrollView>
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          alignItems: "center",
          gap: BRAND.spacing.sm,
        }}
      >
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
        {[{ id: "all", category: "All Categories" }, ...budgets].map(
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
                else setFilterCategoryId(option.id);
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
