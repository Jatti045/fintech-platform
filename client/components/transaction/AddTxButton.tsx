import React from "react";
import { useTheme } from "@/hooks/useRedux";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Text, TouchableOpacity, View } from "react-native";

function AddNewTransactionButton({
  setOpenSheet,
}: {
  setOpenSheet: (val: boolean) => void;
}) {
  const { THEME } = useTheme();
  return (
    <View className="absolute bottom-0 right-0 p-4">
      <TouchableOpacity
        onPress={() => setOpenSheet(true)}
        accessibilityRole="button"
        accessibilityLabel="New Transaction"
      >
        <LinearGradient
          colors={[THEME.primary, THEME.secondary]}
          start={[0, 0]}
          end={[1, 1]}
          style={{
            paddingVertical: 12,
            paddingHorizontal: 12,
            alignItems: "center",
            justifyContent: "center",

            borderRadius: 1000,
            shadowColor: THEME.primary,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.7,
            shadowRadius: 16,
            elevation: 16, // For Android
          }}
        >
          <View className="items-center justify-center flex-row gap-1">
            <Feather name="plus" size={24} color={THEME.textPrimary} />
            <Text
              style={{ color: THEME.textPrimary }}
              className="font-bold text-base"
            >
              New Transaction
            </Text>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

export default AddNewTransactionButton;
