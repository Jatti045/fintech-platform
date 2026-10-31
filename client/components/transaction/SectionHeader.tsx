import React from "react";
import { View, Text } from "react-native";
import { useTheme } from "@/hooks/useRedux";
import { BRAND } from "@/constants/ThemePalettes";
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
        backgroundColor: THEME.subtleSurface,
        borderTopLeftRadius: BRAND.radius.card,
        borderTopRightRadius: BRAND.radius.card,
        borderWidth: 1,
        borderBottomWidth: 0,
        borderColor: THEME.border,
        padding: BRAND.spacing.md,
        marginTop: BRAND.spacing.md,
      }}
    >
      <Text
        accessibilityRole="header"
        style={{
          color: THEME.textPrimary,
          fontSize: 15,
          fontWeight: "700",
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
