import React from "react";
import { Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useRedux";
import SearchBar from "@/components/global/SearchBar";
import { hexToRgba } from "@/utils/helper";

export interface BudgetHeaderProps {
  monthLabel: string;
  /** Whether to render the search bar (shown once budgets exist). */
  showSearch: boolean;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

/**
 * Budget screen header: title/subtitle, the month badge, and the search bar.
 * Pure presentation — search state lives in `useBudgetScreen`.
 */
export default function BudgetHeader({
  monthLabel,
  showSearch,
  searchQuery,
  onSearchChange,
}: BudgetHeaderProps) {
  const { THEME } = useTheme();

  return (
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

      {showSearch && (
        <SearchBar
          searchQuery={searchQuery}
          setSearchQuery={onSearchChange}
          placeholder="Search budgets..."
        />
      )}
    </View>
  );
}
