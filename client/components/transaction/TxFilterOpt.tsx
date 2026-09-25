import React, { useState } from "react";
import {
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { capitalizeFirst, hexToRgba } from "@/utils/helper";
import { useTheme } from "@/hooks/useRedux";

interface FilterTransactionProps {
  budgets: any[];
  filterCategoryId: string | "all";
  setFilterCategoryId: (id: string | "all") => void;
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
  onCalendarPress,
}: FilterTransactionProps) {
  const { THEME } = useTheme();
  const [showMoreModal, setShowMoreModal] = useState(false);

  const selectedBudget = budgets.find((b) => b.id === filterCategoryId);
  const isBudgetSelected = Boolean(selectedBudget);

  const chipStyle = (active: boolean) => ({
    backgroundColor: active ? hexToRgba(THEME.primary, 0.12) : THEME.surface,
    borderColor: active ? THEME.primary : THEME.border,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 7,
    marginRight: 8,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  });

  const chipTextStyle = (active: boolean) => ({
    color: active ? THEME.textPrimary : THEME.textSecondary,
    fontSize: 13,
    fontWeight: (active ? "600" : "500") as "600" | "500",
  });

  return (
    <View style={{ marginBottom: 12 }}>
      {/* ── Filter chips row ──────────────────────────────────────────────── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingRight: 8 }}
        style={{ marginBottom: 12 }}
      >
        {/* 1. All */}
        <TouchableOpacity
          onPress={clearFilters}
          style={chipStyle(filterCategoryId === "all")}
          accessibilityRole="button"
          accessibilityLabel="All categories"
          activeOpacity={0.7}
        >
          <Text style={chipTextStyle(filterCategoryId === "all")}>All</Text>
        </TouchableOpacity>

        {/* 2. Income */}
        <TouchableOpacity
          onPress={() => setFilterCategoryId("income")}
          style={chipStyle(filterCategoryId === "income")}
          accessibilityRole="button"
          accessibilityLabel="Filter by Income"
          activeOpacity={0.7}
        >
          <Text style={chipTextStyle(filterCategoryId === "income")}>
            Income
          </Text>
        </TouchableOpacity>

        {/* 3. Transfer out */}
        <TouchableOpacity
          onPress={() => setFilterCategoryId("transfer_out")}
          style={chipStyle(filterCategoryId === "transfer_out")}
          accessibilityRole="button"
          accessibilityLabel="Filter by Transfer out"
          activeOpacity={0.7}
        >
          <Text style={chipTextStyle(filterCategoryId === "transfer_out")}>
            Transfer out
          </Text>
        </TouchableOpacity>

        {/* 4. Transfer in */}
        <TouchableOpacity
          onPress={() => setFilterCategoryId("transfer_in")}
          style={chipStyle(filterCategoryId === "transfer_in")}
          accessibilityRole="button"
          accessibilityLabel="Filter by Transfer in"
          activeOpacity={0.7}
        >
          <Text style={chipTextStyle(filterCategoryId === "transfer_in")}>
            Transfer in
          </Text>
        </TouchableOpacity>

        {/* 5. More ⌵ (opens category picker) */}
        <TouchableOpacity
          onPress={() => setShowMoreModal(true)}
          style={chipStyle(isBudgetSelected)}
          accessibilityRole="button"
          accessibilityLabel="More category filters"
          activeOpacity={0.7}
        >
          <Text style={chipTextStyle(isBudgetSelected)}>
            {selectedBudget ? capitalizeFirst(selectedBudget.category) : "More"}
          </Text>
          <Feather
            name="chevron-down"
            size={13}
            color={isBudgetSelected ? THEME.primary : THEME.textSecondary}
            style={{ marginLeft: 4 }}
          />
        </TouchableOpacity>

        {/* Render direct budget chips in scroll for quick access and full backward compatibility */}
        {budgets.map((b) => {
          const active = filterCategoryId === b.id;
          return (
            <TouchableOpacity
              key={b.id}
              onPress={() => setFilterCategoryId(b.id)}
              style={chipStyle(active)}
              accessibilityRole="button"
              accessibilityLabel={`Filter by ${b.category}`}
              activeOpacity={0.7}
            >
              <Text style={chipTextStyle(active)}>
                {capitalizeFirst(b.category)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ── Amount range row ────────────────────────────────────────────── */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Text
            style={{
              color: THEME.textSecondary,
              fontSize: 13,
              fontWeight: "500",
              marginRight: 10,
            }}
          >
            Amount
          </Text>

          <TextInput
            placeholder="Min"
            keyboardType="numeric"
            value={minAmount}
            onChangeText={setMinAmount}
            style={{
              width: 80,
              height: 36,
              backgroundColor: THEME.inputBackground,
              borderColor: THEME.border,
              borderWidth: 1,
              borderRadius: 8,
              color: THEME.textPrimary,
              fontSize: 13,
              paddingHorizontal: 10,
              paddingVertical: 0,
            }}
            placeholderTextColor={THEME.placeholderText}
          />

          <Text
            style={{
              color: THEME.placeholderText,
              marginHorizontal: 8,
              fontSize: 14,
            }}
          >
            –
          </Text>

          <TextInput
            placeholder="Max"
            keyboardType="numeric"
            value={maxAmount}
            onChangeText={setMaxAmount}
            style={{
              width: 80,
              height: 36,
              backgroundColor: THEME.inputBackground,
              borderColor: THEME.border,
              borderWidth: 1,
              borderRadius: 8,
              color: THEME.textPrimary,
              fontSize: 13,
              paddingHorizontal: 10,
              paddingVertical: 0,
            }}
            placeholderTextColor={THEME.placeholderText}
          />
        </View>

        {/* Calendar control */}
        <TouchableOpacity
          onPress={onCalendarPress}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Calendar filter"
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            backgroundColor: THEME.surface,
            borderWidth: 1,
            borderColor: THEME.border,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Feather name="calendar" size={16} color={THEME.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* ── More Categories Modal ────────────────────────────────────────── */}
      <Modal
        visible={showMoreModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMoreModal(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowMoreModal(false)}>
          <View
            style={{
              flex: 1,
              backgroundColor: "rgba(0,0,0,0.6)",
              justifyContent: "center",
              alignItems: "center",
              padding: 24,
            }}
          >
            <TouchableWithoutFeedback>
              <View
                style={{
                  width: "100%",
                  maxHeight: 380,
                  backgroundColor: THEME.surface,
                  borderRadius: 18,
                  borderWidth: 1,
                  borderColor: THEME.border,
                  padding: 18,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 14,
                  }}
                >
                  <Text
                    style={{
                      color: THEME.textPrimary,
                      fontSize: 16,
                      fontWeight: "700",
                    }}
                  >
                    Select Category
                  </Text>
                  <TouchableOpacity
                    onPress={() => setShowMoreModal(false)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Feather name="x" size={18} color={THEME.textSecondary} />
                  </TouchableOpacity>
                </View>

                <ScrollView showsVerticalScrollIndicator={false}>
                  <TouchableOpacity
                    onPress={() => {
                      clearFilters();
                      setShowMoreModal(false);
                    }}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      paddingVertical: 12,
                      borderBottomWidth: 1,
                      borderBottomColor: THEME.border,
                    }}
                  >
                    <Text
                      style={{
                        color:
                          filterCategoryId === "all"
                            ? THEME.primary
                            : THEME.textPrimary,
                        fontSize: 14.5,
                        fontWeight: filterCategoryId === "all" ? "600" : "400",
                      }}
                    >
                      All Categories
                    </Text>
                    {filterCategoryId === "all" && (
                      <Feather name="check" size={16} color={THEME.primary} />
                    )}
                  </TouchableOpacity>

                  {budgets.map((b) => {
                    const active = filterCategoryId === b.id;
                    return (
                      <TouchableOpacity
                        key={b.id}
                        onPress={() => {
                          setFilterCategoryId(b.id);
                          setShowMoreModal(false);
                        }}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                          paddingVertical: 12,
                          borderBottomWidth: 1,
                          borderBottomColor: THEME.border,
                        }}
                      >
                        <Text
                          style={{
                            color: active ? THEME.primary : THEME.textPrimary,
                            fontSize: 14.5,
                            fontWeight: active ? "600" : "400",
                          }}
                        >
                          {capitalizeFirst(b.category)}
                        </Text>
                        {active && (
                          <Feather
                            name="check"
                            size={16}
                            color={THEME.primary}
                          />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}
