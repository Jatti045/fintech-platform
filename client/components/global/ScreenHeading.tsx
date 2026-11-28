import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { BRAND, TYPE } from "@/constants/ThemePalettes";
import { useTheme } from "@/hooks/useRedux";

export default function ScreenHeading({
  title,
  accessory,
}: {
  title: string;
  accessory?: React.ReactNode;
}) {
  const { THEME } = useTheme();
  return (
    <View style={styles.header}>
      <Text
        accessibilityRole="header"
        style={[TYPE.screen, { color: THEME.textPrimary, flexShrink: 1 }]}
      >
        {title}
      </Text>
      {accessory}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    minHeight: 52,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    columnGap: BRAND.spacing.sm,
    rowGap: BRAND.spacing.xs,
  },
});
