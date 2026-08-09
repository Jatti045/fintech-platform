import React, { useMemo } from "react";
import { Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import AnimatedNumber from "react-native-animated-numbers";
import { useTheme } from "@/hooks/useRedux";
import { capitalizeFirst, hexToRgba } from "@/utils/helper";
import { safeAmount } from "@/utils/transaction/helpers";
import { utilizationTier } from "@/utils/budget/budgetCalculations";
import GlassPanel from "@/components/global/GlassPanel";
import RingGauge from "@/components/global/RingGauge";
import SpringFill from "@/components/global/SpringFill";

export interface BudgetPulseItem {
  id: string;
  category: string;
  icon?: string;
  displayLimit?: number;
  displaySpent?: number;
  displayCurrency?: string;
}

export interface BudgetPulseProps {
  budgets: BudgetPulseItem[];
  currencyCode: string;
}

function scoreFor(spent: number, limit: number): number {
  if (limit <= 0) return 50;
  const ratio = spent / limit;
  if (ratio <= 0.5) return 100;
  if (ratio <= 0.8) return 80;
  if (ratio <= 1) return 60;
  if (ratio <= 1.2) return 30;
  return 0;
}

/**
 * BudgetPulse — a single discipline score for the month (0–100) shown as a
 * ring, with the top budget channels listed as liquid fills. Replaces the
 * separate BudgetHealthScore + BudgetSummary on Home.
 */
const BudgetPulse = React.memo(function BudgetPulse({
  budgets,
  currencyCode,
}: BudgetPulseProps) {
  const { THEME } = useTheme();

  const stats = useMemo(() => {
    const withStatus = budgets.map((b) => {
      const limit = safeAmount(b.displayLimit);
      const spent = safeAmount(b.displaySpent);
      const ratio = limit > 0 ? spent / limit : 0;
      return { ...b, limit, spent, ratio, tier: utilizationTier(ratio) };
    });

    const score =
      withStatus.length > 0
        ? Math.round(
            withStatus.reduce((sum, b) => sum + scoreFor(b.spent, b.limit), 0) /
              withStatus.length,
          )
        : 0;

    const top = [...withStatus].sort((a, b) => b.spent - a.spent).slice(0, 3);
    return { withStatus, score, top };
  }, [budgets]);

  if (budgets.length === 0) return null;

  const toneColor =
    stats.score >= 75 ? THEME.success : stats.score >= 50 ? THEME.warning : THEME.danger;
  const toneGradient: [string, string] =
    stats.score >= 75
      ? [THEME.primary, THEME.secondary]
      : stats.score >= 50
        ? [THEME.warning, THEME.primary]
        : [THEME.danger, THEME.warning];
  const label =
    stats.score >= 75 ? "On track" : stats.score >= 50 ? "Watch spending" : "Over budget";

  return (
    <GlassPanel padding={14} radius={20} style={{ marginBottom: 14 }}>
      {/* Header + ring */}
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
        <RingGauge
          size={92}
          strokeWidth={9}
          progress={stats.score / 100}
          gradient={toneGradient}
          gradientId="home-budget-pulse"
          trackColor={toneColor}
        >
          <AnimatedNumber
            animateToNumber={stats.score}
            animationDuration={700}
            fontStyle={{ color: THEME.textPrimary, fontSize: 18, fontWeight: "900" }}
          />
        </RingGauge>

        <View style={{ flex: 1, marginLeft: 16 }}>
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
            Budget pulse
          </Text>
          <Text style={{ color: toneColor, fontSize: 18, fontWeight: "900" }}>
            {label}
          </Text>
          <Text style={{ color: THEME.textSecondary, fontSize: 12, marginTop: 2 }}>
            Discipline across {budgets.length}{" "}
            {budgets.length === 1 ? "channel" : "channels"}
          </Text>
        </View>
      </View>

{/* Top channels */}
      <View style={{ gap: 12 }}>
        {stats.top.map((b) => {
          const tierColor =
            b.tier === "over"
              ? THEME.danger
              : b.tier === "warm"
                ? THEME.warning
                : THEME.primary;
          return (
            <View key={b.id}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  marginBottom: 5,
                }}
              >
                <View
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 8,
                    backgroundColor: hexToRgba(tierColor, 0.16),
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: 8,
                  }}
                >
                  <Feather
                    name={(b.icon || "circle") as keyof typeof Feather.glyphMap}
                    size={13}
                    color={tierColor}
                  />
                </View>
                <Text
                  style={{ color: THEME.textPrimary, fontSize: 13, fontWeight: "700", flex: 1 }}
                  numberOfLines={1}
                >
                  {capitalizeFirst(b.category)}
                </Text>
                <Text style={{ color: tierColor, fontSize: 12, fontWeight: "800" }}>
                  {Math.round(b.ratio * 100)}%
                </Text>
              </View>
              <SpringFill
                ratio={Math.min(1, b.ratio)}
                trackColor={hexToRgba(THEME.border, 0.8)}
                colors={
                  b.tier === "over"
                    ? [THEME.danger, THEME.warning]
                    : b.tier === "warm"
                      ? [THEME.warning, THEME.primary]
                      : [THEME.primary, THEME.secondary]
                }
                height={6}
              />
            </View>
          );
        })}
      </View>
    </GlassPanel>
  );
});

export default BudgetPulse;