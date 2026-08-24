import React, { useState } from "react";
import { TextInput, TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useRedux";

type Props = {
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  /** Placeholder text shown when the input is empty. */
  placeholder?: string;
};

/**
 * Modern search bar with enhanced visual design and smooth interactions.
 * Used on the Transaction and Budget screens.
 */
export default function SearchBar({
  searchQuery,
  setSearchQuery,
  placeholder = "Search...",
}: Props) {
  const { THEME } = useTheme();
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View className="mb-4 flex-row items-center">
      <View
        style={{
          flex: 1,
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: THEME.inputBackground,
          borderRadius: 14,
          borderWidth: 2,
          borderColor: isFocused ? THEME.primary : THEME.border,
          paddingHorizontal: 12,
        }}
      >
        <Feather
          name="search"
          size={20}
          color={isFocused ? THEME.primary : THEME.placeholderText}
          style={{ marginRight: 8 }}
        />
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          className="py-3 flex-1 text-base"
          style={{
            color: THEME.textPrimary,
          }}
          placeholderTextColor={THEME.placeholderText}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity
            className="p-2 rounded-full ml-2"
            onPress={() => setSearchQuery("")}
            activeOpacity={0.6}
          >
            <Feather name="x-circle" size={18} color={THEME.textSecondary} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
