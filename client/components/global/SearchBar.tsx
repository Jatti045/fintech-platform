import React, { useState } from "react";
import { StyleSheet, TextInput, TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { BRAND } from "@/constants/ThemePalettes";
import { useTheme } from "@/hooks/useRedux";

type Props = {
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  placeholder?: string;
  clearLabel?: string;
};

export default function SearchBar({
  searchQuery,
  setSearchQuery,
  placeholder = "Search",
  clearLabel = "Clear search",
}: Props) {
  const { THEME } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View
      style={[
        styles.field,
        {
          backgroundColor: THEME.inputBackground,
          borderColor: focused ? THEME.primary : THEME.border,
        },
      ]}
    >
      <Feather
        name="search"
        size={18}
        color={focused ? THEME.primary : THEME.textSecondary}
      />
      <TextInput
        accessibilityLabel={placeholder}
        placeholder={placeholder}
        placeholderTextColor={THEME.placeholderText}
        selectionColor={THEME.primary}
        value={searchQuery}
        onChangeText={setSearchQuery}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        style={[styles.input, { color: THEME.textPrimary }]}
      />
      {!!searchQuery && (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={clearLabel}
          onPress={() => setSearchQuery("")}
          style={styles.clear}
        >
          <Feather name="x" size={18} color={THEME.textSecondary} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    flex: 1,
    minWidth: 128,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: BRAND.radius.input,
    borderWidth: StyleSheet.hairlineWidth,
    paddingLeft: 12,
  },
  input: {
    flex: 1,
    minWidth: 0,
    minHeight: BRAND.touchTarget,
    paddingHorizontal: 10,
    paddingVertical: BRAND.spacing.sm,
    fontSize: 15,
  },
  clear: {
    width: BRAND.touchTarget,
    minHeight: BRAND.touchTarget,
    alignItems: "center",
    justifyContent: "center",
  },
});
