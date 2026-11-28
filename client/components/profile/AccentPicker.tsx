import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { ACCENTS, BRAND, TYPE, isDarkPalette } from "@/constants/ThemePalettes";
import { useAppDispatch, useTheme } from "@/hooks/useRedux";
import { selectAccent } from "@/store/slices/themeSlice";
import type { AccentPreference } from "@/types/theme/types";
import { hapticSelection } from "@/utils/haptics";

export default function AccentPicker() {
  const { THEME, selectedAccent = "Cobalt" } = useTheme();
  const dispatch = useAppDispatch();
  const mode = isDarkPalette(THEME) ? "dark" : "light";

  return (
    <View style={styles.group}>
      <Text style={[TYPE.label, { color: THEME.textPrimary }]}>
        Color scheme
      </Text>
      <View style={styles.options}>
        {(Object.keys(ACCENTS) as AccentPreference[]).map((name) => {
          const selected = selectedAccent === name;
          const colors = ACCENTS[name][mode];
          return (
            <TouchableOpacity
              key={name}
              accessibilityRole="radio"
              accessibilityLabel={`${name} color scheme`}
              accessibilityState={{ checked: selected }}
              aria-checked={selected}
              activeOpacity={0.75}
              onPress={() => {
                if (selected) return;
                hapticSelection();
                void dispatch(selectAccent(name));
              }}
              style={[
                styles.option,
                {
                  borderColor: selected ? colors.ink : THEME.border,
                  backgroundColor: selected ? colors.soft : THEME.surface,
                },
              ]}
            >
              <View style={[styles.swatch, { backgroundColor: colors.ink }]}>
                {selected && (
                  <Feather name="check" size={14} color={colors.onInk} />
                )}
              </View>
              <Text style={[TYPE.caption, { color: THEME.textPrimary }]}>
                {name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: BRAND.spacing.sm, marginTop: BRAND.spacing.md },
  options: { flexDirection: "row", flexWrap: "wrap", gap: BRAND.spacing.sm },
  option: {
    flexGrow: 1,
    flexBasis: 76,
    minHeight: 64,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    padding: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  swatch: {
    height: 22,
    width: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
});
