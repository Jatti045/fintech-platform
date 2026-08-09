import React from "react";
import { View, Text } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useRedux";
import { formatCurrency, hexToRgba } from "@/utils/helper";
import { friendlyDayLabel } from "../../utils/transaction/helpers";

/**
 * DayRail — a glass date divider showing the friendly day label and the
 * day’s total spend. Rendered as a section header in the ledger stream.
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
  const { THEME } = useTheme();

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        marginTop: 6,
        marginBottom: 8,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 12,
        backgroundColor: hexToRgba(THEME.surface, 0.6),
        borderColor: THEME.border,
        borderWidth: 1,
      }}
    >
      <View
        style={{ flex: 1, flexDirection: "row", alignItems: "center" }}
      >
        <Feather
          name="calendar"
          size={12}
          color={THEME.textSecondary}
          style={{ marginRight: 6 }}
        />
        <Text
          style={{ color: THEME.textPrimary, fontSize: 13, fontWeight: "700" }}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {friendlyDayLabel(title)}
        </Text>
      </View>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          marginLeft: 8,
        }}
      >
        <View
          style={{
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: total > 0 ? THEME.primary : THEME.textDisabled,
            marginRight: 6,
          }}
        />
        <Text
          style={{ color: THEME.textPrimary, fontSize: 13, fontWeight: "800" }}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {formatCurrency(total, currencyCode)}
        </Text>
      </View>
    </View>
  );
});

export default SectionHeader;
