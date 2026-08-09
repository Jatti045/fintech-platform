import React, { useMemo } from "react";
import { Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import AnimatedNumber from "react-native-animated-numbers";
import { useTheme } from "@/hooks/useRedux";
import { formatCurrency, hexToRgba } from "@/utils/helper";
import { safeAmount } from "@/utils/transaction/helpers";
import { utilizationTier } from "@/utils/budget/budgetCalculations";
import { getCurrencySymbol } from "@/constants/Currencies";
import GlassPanel from "@/components/global/GlassPanel";
import RingGauge from "@/components/global/RingGauge";

export interface BudgetHaloItem {
  id: string;
  displayLimit?: number;
  displaySpent?: number;
}

export interface BudgetHaloProps {
  budgets: BudgetHaloItem[];
  monthLabel: string;
  currencyCode: string;
}

/**
 * The master dial — a segmented liquid-glass gauge that reads the whole
 * month at a glance:
 *   - outer arc  : aggregate utilization (spent ÷ total limits)
 *   - inner ring : spending distribution per category (status-coloured)
 *   - centre     : count-up spent figure + remaining pill
 *   - right rail : utilization %, on-track / warm / over ticks
 */
const BudgetHalo = React.memo(function BudgetHalo({
  budgets,
  monthLabel,
  currencyCode,
}: BudgetHaloProps) {
  const { THEME } = useTheme();

  const stats = useMemo(() => {
    let totalLimit = 0;
    let totalSpent = 0;
    let onTrack = 0;
    let over = 0;
    let warm = 0;

    for (const b of budgets) {
      const limit = safeAmount(b.displayLimit);
      const spent = safeAmount(b.displaySpent);
      totalLimit += limit;
      totalSpent += spent;

      const tier = utilizationTier(limit > 0 ? spent / limit : 0);
      if (tier === "over") over++;
      else if (tier === "warm") warm++;
      else onTrack++;
    }

    return {
      totalLimit,
      totalSpent,
      remaining: Math.max(0, totalLimit - totalSpent),
      utilization: totalLimit > 0 ? Math.min(1, totalSpent / totalLimit) : 0,
      onTrack,
      warm,
      over,
      budgetCount: budgets.length,
    };
  }, [budgets]);

  const segments = useMemo(() => {
    if (stats.totalSpent <= 0) return [];
    const palette = [
      THEME.chart1,
      THEME.chart2,
      THEME.chart3,
      THEME.chart4,
      THEME.primary,
      THEME.secondary,
    ];
    let colorIndex = 0;

    return budgets
      .map((b) => {
        const limit = safeAmount(b.displayLimit);
        const spent = safeAmount(b.displaySpent);
        const tier = utilizationTier(limit > 0 ? spent / limit : 0);

        let color: string;
        if (tier === "over") color = THEME.danger;
        else if (tier === "warm") color = THEME.warning;
        else {
          color = palette[colorIndex % palette.length];
          colorIndex++;
        }

        return {
          fraction: Math.max(0, Math.min(1, spent / stats.totalSpent)),
          color,
        };
      })
      .filter((s) => s.fraction > 0);
  }, [budgets, stats.totalSpent, THEME]);

  const utilizationPercent = Math.round(stats.utilization * 100);
  const overspent = stats.totalSpent > stats.totalLimit && stats.totalLimit > 0;

  return (
    <GlassPanel padding={16} radius={24} style={{ marginBottom: 14 }}>
      {/* Top row: eyebrow + month */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <View
            style={{
              width: 26,
              height: 26,
              borderRadius: 8,
              backgroundColor: hexToRgba(THEME.primary, 0.16),
              alignItems: "center",
              justifyContent: "center",
              marginRight: 8,
            }}
          >
            <Feather name="droplet" size={14} color={THEME.primary} />
          </View>
          <Text
            style={{
              color: THEME.textPrimary,
              fontSize: 12,
              fontWeight: "700",
              letterSpacing: 0.6,
              textTransform: "uppercase",
            }}
          >
            {monthLabel}
          </Text>
        </View>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: hexToRgba(THEME.surface, 0.6),
            borderRadius: 999,
            paddingHorizontal: 10,
            paddingVertical: 4,
          }}
        >
          <View
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: overspent ? THEME.danger : THEME.success,
              marginRight: 6,
            }}
          />
          <Text style={{ color: THEME.textSecondary, fontSize: 11 }}>
            {stats.budgetCount}{" "}
            {stats.budgetCount === 1 ? "channel" : "channels"}
          </Text>
        </View>
      </View>

      {/* Dial + vitals */}
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <RingGauge
          size={158}
          strokeWidth={13}
          progress={stats.utilization}
          gradient={[THEME.primary, THEME.secondary]}
          gradientId="halo-util"
          segments={segments}
          segmentsStrokeWidth={8}
          trackColor={overspent ? THEME.danger : THEME.primary}
        >
          <View style={{ alignItems: "center" }}>
            <Text
              style={{
                color: THEME.textSecondary,
                fontSize: 10,
                fontWeight: "700",
                letterSpacing: 1,
                textTransform: "uppercase",
                marginBottom: 2,
              }}
            >
              Spent
            </Text>
            <View style={{ flexDirection: "row", alignItems: "baseline" }}>
              <Text
                style={{
                  color: THEME.textPrimary,
                  fontSize: 20,
                  fontWeight: "900",
                  marginRight: 2,
                }}
              >
                {getCurrencySymbol(currencyCode)}
              </Text>
              <AnimatedNumber
                includeComma
                animateToNumber={Math.round(stats.totalSpent)}
                animationDuration={700}
                fontStyle={{
                  color: THEME.textPrimary,
                  fontSize: 24,
                  fontWeight: "900",
                  letterSpacing: -0.5,
                }}
              />
            </View>
            <View
              style={{
                marginTop: 6,
                borderRadius: 999,
                paddingHorizontal: 8,
                paddingVertical: 3,
                backgroundColor: hexToRgba(
                  overspent ? THEME.danger : THEME.success,
                  0.14,
                ),
              }}
            >
              <Text
                style={{
                  color: overspent ? THEME.danger : THEME.success,
                  fontSize: 10,
                  fontWeight: "800",
                }}
              >
                {overspent
                  ? `Over ${formatCurrency(
                      Math.abs(stats.totalLimit - stats.totalSpent),
                      currencyCode,
                    )}`
                  : `${formatCurrency(stats.remaining, currencyCode)} left`}
              </Text>
            </View>
          </View>
        </RingGauge>

        {/* Right vitals rail */}
        <View style={{ flex: 1, marginLeft: 18 }}>
          <Text
            style={{
              color: THEME.textSecondary,
              fontSize: 10,
              fontWeight: "700",
              letterSpacing: 1,
              textTransform: "uppercase",
            }}
          >
            Limits used
          </Text>
          <AnimatedNumber
            includeComma
            animateToNumber={utilizationPercent}
            animationDuration={700}
            fontStyle={{
              color: overspent ? THEME.danger : THEME.textPrimary,
              fontSize: 34,
              fontWeight: "900",
              letterSpacing: -1,
            }}
          />
          <Text
            style={{
              color: THEME.textSecondary,
              fontSize: 12,
              marginBottom: 12,
            }}
          >
            of monthly limits
          </Text>

          {stats.budgetCount > 0 && (
            <View style={{ gap: 6 }}>
              <HaloTick
                color={THEME.success}
                label="On track"
                value={stats.onTrack}
              />
              <HaloTick color={THEME.warning} label="Warm" value={stats.warm} />
              <HaloTick color={THEME.danger} label="Over" value={stats.over} />
            </View>
          )}
        </View>
      </View>
    </GlassPanel>
  );
});

function HaloTick({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value: number;
}) {
  const { THEME } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      <View
        style={{
          width: 7,
          height: 7,
          borderRadius: 4,
          backgroundColor: color,
          marginRight: 8,
        }}
      />
      <Text style={{ color: THEME.textSecondary, fontSize: 12, flex: 1 }}>
        {label}
      </Text>
      <Text
        style={{
          color: THEME.textPrimary,
          fontSize: 13,
          fontWeight: "800",
          minWidth: 22,
          textAlign: "right",
        }}
      >
        {value}
      </Text>
    </View>
  );
}

export default BudgetHalo;
