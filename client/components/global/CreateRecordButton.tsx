import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { BRAND, TYPE } from "@/constants/ThemePalettes";
import { useTheme } from "@/hooks/useRedux";

export default function CreateRecordButton({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  const { THEME } = useTheme();

  return (
    <View
      style={{
        alignSelf: "flex-start",
        marginVertical: BRAND.spacing.sm,
        maxWidth: "100%",
      }}
    >
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onPress}
        activeOpacity={0.8}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: BRAND.spacing.sm,
          minHeight: BRAND.touchTarget,
          paddingHorizontal: BRAND.spacing.md,
          paddingVertical: BRAND.spacing.sm,
          borderRadius: BRAND.radius.button,
          backgroundColor: THEME.primary,
        }}
      >
        <Feather name="plus" size={18} color={THEME.onPrimary} />
        <Text style={[TYPE.label, { color: THEME.onPrimary, flexShrink: 1 }]}>
          {label}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
