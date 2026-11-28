import React from "react";
import { StyleSheet, Text, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import Animated from "react-native-reanimated";
import { BRAND, TYPE } from "@/constants/ThemePalettes";
import { usePressMotion } from "@/hooks/usePressMotion";
import { useTheme } from "@/hooks/useRedux";

export default function CreateRecordButton({
  label,
  onPress,
  compact = false,
}: {
  label: string;
  onPress: () => void;
  compact?: boolean;
}) {
  const { THEME } = useTheme();
  const press = usePressMotion();

  return (
    <Animated.View style={press.style}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        activeOpacity={0.8}
        style={[
          styles.button,
          compact && styles.compact,
          { backgroundColor: THEME.primary },
        ]}
      >
        <Feather name="plus" size={21} color={THEME.onPrimary} />
        {!compact && (
          <Text style={[TYPE.label, { color: THEME.onPrimary, flexShrink: 1 }]}>
            {label}
          </Text>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: BRAND.touchTarget,
    borderRadius: BRAND.radius.button,
    paddingHorizontal: BRAND.spacing.md,
  },
  compact: { width: BRAND.touchTarget, paddingHorizontal: 0 },
});
