import React from "react";
import { StyleSheet, View, Text } from "react-native";
import { useTheme } from "@/hooks/useRedux";
import { BRAND, TYPE } from "@/constants/ThemePalettes";
import { formatCurrency } from "@/utils/helper";

const SectionHeader = React.memo(function SectionHeader({
  title,
  total,
  currencyCode,
}: {
  title: string;
  total: number;
  currencyCode?: string;
}) {
  const { THEME } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        justifyContent: "space-between",
        alignItems: "center",
        gap: BRAND.spacing.sm,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderColor: THEME.border,
        paddingVertical: BRAND.spacing.sm,
        marginTop: BRAND.spacing.md,
      }}
    >
      <Text
        accessibilityRole="header"
        style={{
          color: THEME.textPrimary,
          ...TYPE.label,
          flexShrink: 1,
        }}
      >
        {title}
      </Text>
      <Text style={{ color: THEME.textSecondary, fontSize: 12, flexShrink: 1 }}>
        Loaded net spending · {formatCurrency(total, currencyCode)}
      </Text>
    </View>
  );
});
export default SectionHeader;
