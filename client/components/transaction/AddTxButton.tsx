import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useRedux";

export default function AddNewTransactionButton({
  setOpenSheet,
}: {
  setOpenSheet: (val: boolean) => void;
}) {
  const { THEME, selectedTheme } = useTheme();
  const ctaColor = selectedTheme === "Light" ? "#FFFFFF" : "#111113";

  return (
    <View
      style={{
        position: "absolute",
        bottom: 20,
        right: 16,
        zIndex: 50,
      }}
    >
      <TouchableOpacity
        onPress={() => setOpenSheet(true)}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="New Transaction"
        style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: THEME.primary,
          paddingVertical: 12,
          paddingHorizontal: 18,
          borderRadius: 24,
          shadowColor: "#000000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.25,
          shadowRadius: 10,
          elevation: 6,
        }}
      >
        <Feather
          name="plus"
          size={18}
          color={ctaColor}
          style={{ marginRight: 6 }}
        />
        <Text
          style={{
            color: ctaColor,
            fontSize: 14.5,
            fontWeight: "700",
            letterSpacing: -0.2,
          }}
        >
          New Transaction
        </Text>
      </TouchableOpacity>
    </View>
  );
}
