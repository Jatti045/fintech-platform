import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { BRAND, TYPE } from "@/constants/ThemePalettes";
import { useTheme } from "@/hooks/useRedux";
import { formatCurrency } from "@/utils/helper";

type Props = {
  daily?: { day: number; netSpent: number }[];
  monthLabel: string;
  currencyCode: string;
};

const HEIGHT = 54;

/** Plots the report's signed daily values against one shared zero line. */
export default function MonthlySpendingChart({
  daily,
  monthLabel,
  currencyCode,
}: Props) {
  const { THEME } = useTheme();
  if (!daily?.length || daily.every(({ netSpent }) => netSpent === 0))
    return null;

  const highest = daily.reduce(
    (max, point) => Math.max(max, point.netSpent),
    0,
  );
  const lowest = daily.reduce((min, point) => Math.min(min, point.netSpent), 0);
  const range = highest - lowest;
  const zero = (highest / range) * HEIGHT;
  const first = daily[0].day;
  const last = daily[daily.length - 1].day;
  const summary = `Daily net spending for ${monthLabel}, days ${first} to ${last}. Highest ${formatCurrency(highest, currencyCode)}${lowest < 0 ? `, lowest ${formatCurrency(lowest, currencyCode)}` : ""}.`;

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={summary}
      style={styles.chart}
    >
      <View style={styles.plot}>
        <View
          style={[
            styles.baseline,
            { top: zero, backgroundColor: THEME.statementRule },
          ]}
        />
        {daily.map(({ day, netSpent }) => (
          <View key={day} style={styles.column}>
            <View
              style={[
                styles.bar,
                {
                  top: netSpent > 0 ? zero - (netSpent / range) * HEIGHT : zero,
                  height: (Math.abs(netSpent) / range) * HEIGHT,
                  backgroundColor:
                    netSpent < 0 ? THEME.statementMuted : THEME.statementAccent,
                },
              ]}
            />
          </View>
        ))}
      </View>
      <View style={styles.labels}>
        <Text style={[TYPE.caption, { color: THEME.statementMuted }]}>
          Daily spending
        </Text>
        <Text style={[TYPE.caption, { color: THEME.statementMuted }]}>
          {first === last ? `Day ${first}` : `Days ${first}–${last}`}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chart: {
    marginTop: BRAND.spacing.md,
    marginBottom: BRAND.spacing.sm,
    gap: BRAND.spacing.sm,
  },
  plot: { flexDirection: "row", height: HEIGHT, gap: 2 },
  baseline: {
    position: "absolute",
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
  },
  column: { flex: 1 },
  bar: { position: "absolute", left: 0, right: 0, borderRadius: 2 },
  labels: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: BRAND.spacing.xs,
  },
});
