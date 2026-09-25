import React from "react";
import { View, Text } from "react-native";
import { Feather } from "@expo/vector-icons";
import { formatCurrency } from "@/utils/helper";

/**
 * SectionHeader — matching the reference design:
 * August 2026           • $197.24 ⌵
 * Forms the top rounded boundary of the transaction ledger container.
 */
const SectionHeader = React.memo(function SectionHeader({
  title,
  total,
  currencyCode,
}: {
  title: string;
  total: number;
  currencyCode?: string;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: "#141416",
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        borderWidth: 1,
        borderBottomWidth: 0,
        borderColor: "#212124",
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 12,
        marginTop: 6,
      }}
    >
      <Text
        style={{
          color: "#FFFFFF",
          fontSize: 16,
          fontWeight: "600",
          letterSpacing: -0.2,
        }}
        numberOfLines={1}
      >
        {title}
      </Text>

      <View style={{ flexDirection: "row", alignItems: "center" }}>
        {/* Budgee Gold Dot Indicator */}
        <View
          style={{
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: "#D4AF6A",
            marginRight: 8,
          }}
        />

        {/* Total Spend */}
        <Text
          style={{
            color: "#FFFFFF",
            fontSize: 15,
            fontWeight: "700",
          }}
        >
          {formatCurrency(total, currencyCode)}
        </Text>

        {/* Dropdown Chevron */}
        <Feather
          name="chevron-down"
          size={16}
          color="#8E8E93"
          style={{ marginLeft: 6 }}
        />
      </View>
    </View>
  );
});

export default SectionHeader;
