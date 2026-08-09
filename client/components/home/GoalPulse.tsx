import React, { useMemo } from "react";
import { Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import AnimatedNumber from "react-native-animated-numbers";
import { useTheme } from "@/hooks/useRedux";
import { safeAmount } from "@/utils/transaction/helpers";
import { getCurrencySymbol } from "@/constants/Currencies";
import GlassPanel from "@/components/global/GlassPanel";
import RingGauge from "@/components/global/RingGauge";

export interface GoalPulseItem {
  id: string;
  target?: number | string;
  progress?: number | string;
  achieved?: boolean;
}

export interface GoalPulseProps {
  goals: GoalPulseItem[];
  currencyCode: string;
}

/**
 * GoalPulse — a compact aggregate of all goals: total saved vs targets with
 * a small ring, plus the conquered / climbing tally. Keeps goal progress
 * visible on Home without duplicating the full Ascent trail.
 */
const GoalPulse = React.memo(function GoalPulse({
  goals,
  currencyCode,
}: GoalPulseProps) {
  const { THEME } = useTheme();

  const stats = useMemo(() => {
    let totalTarget = 0;
    let totalSaved = 0;
    let conquered = 0;
    for (const g of goals) {
      const t = safeAmount(g.target);
      const p = safeAmount(g.progress);
      totalTarget += t;
      totalSaved += p;
      if (g.achieved || (t > 0 && p >= t)) conquered++;
    }
    return {
      totalTarget,
      totalSaved,
      conquered,
      climbing: Math.max(0, goals.length - conquered),
      ratio: totalTarget > 0 ? Math.min(1, totalSaved / totalTarget) : 0,
    };
  }, [goals]);

  if (goals.length === 0) return null;

  return (
    <GlassPanel padding={14} radius={20} style={{ marginBottom: 14 }}>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <RingGauge
          size={92}
          strokeWidth={9}
          progress={stats.ratio}
          gradient={[THEME.primary, THEME.secondary]}
          gradientId="home-goal-pulse"
          trackColor={THEME.secondary}
        >
          <Text
            style={{ color: THEME.textPrimary, fontSize: 16, fontWeight: "900" }}
          >
            {Math.round(stats.ratio * 100)}%
          </Text>
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
            Saved across goals
          </Text>
          <View style={{ flexDirection: "row", alignItems: "baseline" }}>
            <Text
              style={{ color: THEME.textPrimary, fontSize: 16, fontWeight: "900", marginRight: 2 }}
            >
              {getCurrencySymbol(currencyCode)}
            </Text>
            <AnimatedNumber
              includeComma
              animateToNumber={Math.round(stats.totalSaved)}
              animationDuration={700}
              fontStyle={{
                color: THEME.textPrimary,
                fontSize: 20,
                fontWeight: "900",
                letterSpacing: -0.5,
              }}
            />
            <Text style={{ color: THEME.textSecondary, fontSize: 12, marginLeft: 4 }}>
              of {getCurrencySymbol(currencyCode)}
              {Math.round(stats.totalTarget)}
            </Text>
          </View>

          <View style={{ flexDirection: "row", marginTop: 8, gap: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Feather name="award" size={11} color={THEME.success} style={{ marginRight: 4 }} />
              <Text style={{ color: THEME.success, fontSize: 11, fontWeight: "800" }}>
                {stats.conquered} conquered
              </Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Feather name="flag" size={11} color={THEME.primary} style={{ marginRight: 4 }} />
              <Text style={{ color: THEME.textSecondary, fontSize: 11, fontWeight: "700" }}>
                {stats.climbing} climbing
              </Text>
            </View>
          </View>
        </View>
      </View>
    </GlassPanel>
  );
});

export default GoalPulse;