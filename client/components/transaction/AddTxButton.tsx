import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useRedux";
import { BRAND } from "@/constants/ThemePalettes";

export default function AddNewTransactionButton({
  setOpenSheet,
}: {
  setOpenSheet: (val: boolean) => void;
}) {
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
        accessibilityLabel="New Transaction"
        onPress={() => setOpenSheet(true)}
        activeOpacity={0.85}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: BRAND.spacing.sm,
          backgroundColor: THEME.primary,
          padding: BRAND.spacing.md,
          minHeight: 52,
          borderRadius: BRAND.radius.button,
        }}
      >
        <Feather name="plus" size={20} color={THEME.onPrimary} />
        <Text
          style={{ color: THEME.onPrimary, fontSize: 15, fontWeight: "700" }}
        >
          New Transaction
        </Text>
      </TouchableOpacity>
    </View>
  );
}
