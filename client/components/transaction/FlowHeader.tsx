import React, { useEffect, useMemo, useState } from "react";
import { Text, View, type LayoutChangeEvent } from "react-native";
import { Feather } from "@expo/vector-icons";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import AnimatedNumber from "react-native-animated-numbers";
import { useTheme } from "@/hooks/useRedux";
import { formatCurrency, hexToRgba } from "@/utils/helper";
import { buildDailySpendTotals } from "@/utils/transaction/helpers";
import type { ITransaction } from "@/types/transaction/types";
import GlassPanel from "@/components/global/GlassPanel";

export interface FlowHeaderProps {
  transactions: ITransaction[];
  month: number;
  year: number;
  monthlyIncome: number;
  currencyCode: string;
}

const CHART_H = 42;
const BAR_W = 3;
const GAP = 3;

/**
 * FlowHeader — the ledger “readout”. A big animated month-spent figure sits
 * above a compact daily-spend sparkline, with a net pill telling you how the
 * month is tracking against income.
 */
const FlowHeader = React.memo(function FlowHeader({
  transactions,
  month,
  year,
  monthlyIncome,
  currencyCode,
}: FlowHeaderProps) {
  const { THEME } = useTheme();
  const [width, setWidth] = useState(0);

  const series = useMemo(
    () => buildDailySpendTotals(transactions, month, year),
    [transactions, month, year],
  );
  const total = useMemo(
    () => series.reduce((acc, s) => acc + s.total, 0),
    [series],
  );
  const maxTotal = useMemo(
    () => Math.max(1, ...series.map((s) => s.total)),
    [series],
  );
  const income = Math.max(0, monthlyIncome || 0);
  const net = income - total;

  return (
    <GlassPanel
      glow
      tinted
      padding={14}
      radius={20}
      style={{ marginBottom: 14 }}
    >
      {/* Total spent */}
      <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 10 }}>
        <View>
          <Text
            style={{
              color: THEME.textSecondary,
              fontSize: 10,
              fontWeight: "700",
              letterSpacing: 0.6,
              textTransform: "uppercase",
              marginBottom: 2,
            }}
          >
            Spent this month
          </Text>
          <View style={{ flexDirection: "row", alignItems: "baseline" }}>
            <AnimatedNumber
              includeComma
              animateToNumber={Math.round(total)}
              animationDuration={600}
              fontStyle={{ color: THEME.textPrimary, fontSize: 26, fontWeight: "900", letterSpacing: -0.5 }}
            />
            <Text style={{ color: THEME.textSecondary, fontSize: 13, marginLeft: 4 }}>
              {currencyCode}
            </Text>
          </View>
        </View>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            borderRadius: 999,
            paddingHorizontal: 10,
            paddingVertical: 5,
            backgroundColor: hexToRgba(net < 0 ? THEME.danger : THEME.success, 0.12),
          }}
        >
          <Feather
            name={net < 0 ? "trending-down" : "trending-up"}
            size={12}
            color={net < 0 ? THEME.danger : THEME.success}
            style={{ marginRight: 4 }}
          />
          <Text style={{ color: net < 0 ? THEME.danger : THEME.success, fontSize: 12, fontWeight: "800" }}>
            {net < 0 ? "Over" : "Net"} {formatCurrency(Math.abs(net), currencyCode)}
          </Text>
        </View>
      </View>

      {/* Daily sparkline */}
      <View
        onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
        style={{
          height: CHART_H,
          backgroundColor: hexToRgba(THEME.border, 0.3),
          borderRadius: 10,
          overflow: "hidden",
          flexDirection: "row",
          alignItems: "flex-end",
        }}
      >
        {width > 0 &&
          series.map((s, i) => {
            const h = Math.max(2, (s.total / maxTotal) * (CHART_H - 6));
            return (
              <FlowBar
                key={s.day}
                height={h}
                color={s.total > 0 ? THEME.primary : hexToRgba(THEME.textDisabled, 0.3)}
              />
            );
          })}
      </View>
    </GlassPanel>
  );
});

function FlowBar({ height, color }: { height: number; color: string }) {
  const grow = useSharedValue(0);
  useEffect(() => {
    grow.value = withSpring(1, { damping: 18, stiffness: 120 });
  }, [grow]);
  const style = useAnimatedStyle(() => ({
    transformOrigin: "bottom",
    transform: [{ scaleY: grow.value }],
  }));
  return (
    <Animated.View
      style={[
        {
          width: BAR_W,
          height,
          marginHorizontal: GAP / 2,
          borderRadius: 1.5,
          backgroundColor: color,
        },
        style,
      ]}
    />
  );
}

export default FlowHeader;