import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";

export default function AddNewTransactionButton({
  setOpenSheet,
}: {
  setOpenSheet: (val: boolean) => void;
}) {
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
          backgroundColor: "#E8D595",
          paddingVertical: 12,
          paddingHorizontal: 18,
          borderRadius: 24,
          shadowColor: "#000000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.35,
          shadowRadius: 10,
          elevation: 6,
        }}
      >
        <Feather
          name="plus"
          size={18}
          color="#111111"
          style={{ marginRight: 6 }}
        />
        <Text
          style={{
            color: "#111111",
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
