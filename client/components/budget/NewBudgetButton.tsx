import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useRedux";
import { BRAND } from "@/constants/ThemePalettes";
export interface NewBudgetButtonProps {
  onPress: () => void;
}
const NewBudgetButton = React.memo(function NewBudgetButton({
  onPress,
}: NewBudgetButtonProps) {
  const { THEME } = useTheme();
  return (
    <View
      style={{
        position: "absolute",
        bottom: BRAND.spacing.lg,
        right: BRAND.spacing.md,
        zIndex: 50,
      }}
    >
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="New Budget"
        onPress={onPress}
        activeOpacity={0.85}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: BRAND.spacing.sm,
          minHeight: 52,
          padding: BRAND.spacing.md,
          borderRadius: BRAND.radius.button,
          backgroundColor: THEME.primary,
        }}
      >
        <Feather name="plus" size={20} color={THEME.onPrimary} />
        <Text
          style={{ color: THEME.onPrimary, fontSize: 15, fontWeight: "700" }}
        >
          New Budget
        </Text>
      </TouchableOpacity>
    </View>
  );
});
export default NewBudgetButton;
