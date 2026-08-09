import React, { useEffect, useMemo, useState } from "react";
import { Text, View, type LayoutChangeEvent } from "react-native";
import { Feather } from "@expo/vector-icons";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useTheme } from "@/hooks/useRedux";
import { formatCurrency, hexToRgba } from "@/utils/helper";
import { buildDailySpendTotals } from "@/utils/transaction/helpers";
import type { ITransaction } from "@/types/transaction/types";
import GlassPanel from "@/components/global/GlassPanel";

export interface SpendingRhythmProps {
  transactions: ITransaction[];
  month: number;
  year: number;
  currencyCode: string;
}

const CHART_HEIGHT = 84;
const BAR_W = 5;
const GAP = 8;

/**
 * SpendingRhythm — a day-by-day bar chart of the month’s spending. It shows
 * the *shape* of the month (trends, spikes, quiet days) at a glance, with
 * today highlighted and the busiest day called out.
 */
const SpendingRhythm = React.memo(function SpendingRhythm({
  transactions,
  month,
  year,
  currencyCode,
}: SpendingRhythmProps) {
  const { THEME } = useTheme();
  const [width, setWidth] = useState(0);

  const series = useMemo(
    () => buildDailySpendTotals(transactions, month, year),
    [transactions, month, year],
  );

  const maxTotal = useMemo(
    () => Math.max(1, ...series.map((s) => s.total)),
    [series],
  );

  const today = new Date();
  const isCurrent = today.getMonth() === month && today.getFullYear() === year;
  const todayIdx = isCurrent ? today.getDate() - 1 : -1;

  const totalSpent = useMemo(
    () => series.reduce((acc, s) => acc + s.total, 0),
    [series],
  );

  const busiest = useMemo(() => {
    let day = 0;
    let val = 0;
    for (const s of series) {
      if (s.total > val) {
        val = s.total;
        day = s.day;
      }
    }
    return { day, val };
  }, [series]);

  return (
    <GlassPanel padding={14} radius={20} style={{ marginBottom: 14 }}>
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: THEME.primary,
              marginRight: 8,
            }}
          />
          <Text
            style={{
              color: THEME.textPrimary,
              fontSize: 13,
              fontWeight: "800",
              textTransform: "uppercase",
              letterSpacing: 0.4,
            }}
          >
            Rhythm
          </Text>
        </View>
        <Text style={{ color: THEME.textSecondary, fontSize: 12 }}>
          {formatCurrency(totalSpent, currencyCode)} this month
        </Text>
      </View>

      {/* Bars */}
      <View
        onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
        style={{
          height: CHART_HEIGHT,
          backgroundColor: hexToRgba(THEME.border, 0.3),
          borderRadius: 14,
          overflow: "hidden",
        }}
      >
        {width > 0 &&
          series.map((s, i) => {
            const h = Math.max(2, (s.total / maxTotal) * (CHART_HEIGHT - 10));
            const x = 8 + i * (BAR_W + GAP);
            const isToday = i === todayIdx;
            const color =
              s.total > 0
                ? isToday
                  ? THEME.secondary
                  : THEME.primary
                : hexToRgba(THEME.textDisabled, 0.35);
            return (
              <Bar
                key={s.day}
                x={x}
                bottom={6}
                height={h}
                color={color}
                radius={2.5}
              />
            );
          })}
      </View>

      {/* Footer: busiest day + today hint */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: 10,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Feather name="bar-chart-2" size={12} color={THEME.textSecondary} style={{ marginRight: 5 }} />
          <Text style={{ color: THEME.textSecondary, fontSize: 11 }}>
            {busiest.val > 0
              ? `Busiest day: Day ${busiest.day}`
              : "No spending recorded yet"}
          </Text>
        </View>
        {isCurrent ? (
          <Text style={{ color: THEME.textSecondary, fontSize: 11 }}>
            Today highlighted
          </Text>
        ) : null}
      </View>
    </GlassPanel>
  );
});

function Bar({
  x,
  bottom,
  height,
  color,
  radius,
}: {
  x: number;
  bottom: number;
  height: number;
  color: string;
  radius: number;
}) {
  const grow = useSharedValue(0);
  useEffect(() => {
    grow.value = withSpring(1, { damping: 18, stiffness: 120 });
  }, [grow]);

  const animatedBarStyle = useAnimatedStyle(() => ({
    transformOrigin: "bottom",
    transform: [{ scaleY: grow.value }],
  }));

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          left: x,
          bottom,
          width: BAR_W,
          height,
          borderRadius: radius,
          backgroundColor: color,
        },
        animatedBarStyle,
      ]}
    />
  );
}

export default SpendingRhythm;