import React from "react";
import { useTheme } from "@/hooks/useRedux";
import { capitalizeFirst, hexToRgba } from "@/utils/helper";
import {
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

function FilterTransaction({
  budgets,
  filterCategoryId,
  setFilterCategoryId,
  minAmount,
  setMinAmount,
  maxAmount,
  setMaxAmount,
  clearFilters,
}: {
  budgets: any[];
  filterCategoryId: string | "all";
  setFilterCategoryId: (id: string | "all") => void;
  minAmount: string;
  setMinAmount: (amount: string) => void;
  maxAmount: string;
  setMaxAmount: (amount: string) => void;
  clearFilters: () => void;
}) {
  const { THEME } = useTheme();

  const chipStyle = (active: boolean) => ({
    backgroundColor: active ? hexToRgba(THEME.primary, 0.18) : hexToRgba(THEME.surface, 0.6),
    borderColor: active ? THEME.primary : THEME.border,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
  });

  return (
    <View>
      {/* Category chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginBottom: 8 }}
      >
        <TouchableOpacity
          onPress={clearFilters}
          style={chipStyle(filterCategoryId === "all")}
          accessibilityRole="button"
          accessibilityLabel="All categories"
        >
          <Text style={{ color: THEME.textPrimary, fontSize: 13, fontWeight: "700" }}>
            All
          </Text>
        </TouchableOpacity>
        {budgets.map((b) => {
          const active = filterCategoryId === b.id;
          return (
            <TouchableOpacity
              key={b.id}
              onPress={() => setFilterCategoryId(b.id)}
              style={chipStyle(active)}
              accessibilityRole="button"
              accessibilityLabel={`Filter by ${b.category}`}
            >
              <Text
                style={{
                  color: active ? THEME.primary : THEME.textPrimary,
                  fontSize: 13,
                  fontWeight: "700",
                }}
              >
                {capitalizeFirst(b.category)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Amount range */}
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Text style={{ color: THEME.textSecondary, fontSize: 12, marginRight: 8 }}>
          Amount
        </Text>
        <TextInput
          placeholder="Min"
          keyboardType="numeric"
          value={minAmount}
          onChangeText={setMinAmount}
          style={{
            flex: 1,
            backgroundColor: hexToRgba(THEME.surface, 0.6),
            borderColor: THEME.border,
            borderWidth: 1,
            color: THEME.textPrimary,
            borderRadius: 10,
            paddingVertical: 8,
            paddingHorizontal: 12,
          }}
          placeholderTextColor={THEME.placeholderText}
        />
        <Text style={{ color: THEME.textSecondary, marginHorizontal: 8 }}>–</Text>
        <TextInput
          placeholder="Max"
          keyboardType="numeric"
          value={maxAmount}
          onChangeText={setMaxAmount}
          style={{
            flex: 1,
            backgroundColor: hexToRgba(THEME.surface, 0.6),
            borderColor: THEME.border,
            borderWidth: 1,
            color: THEME.textPrimary,
            borderRadius: 10,
            paddingVertical: 8,
            paddingHorizontal: 12,
          }}
          placeholderTextColor={THEME.placeholderText}
        />
      </View>
    </View>
  );
}

export default FilterTransaction;
