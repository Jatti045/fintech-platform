import React, { useMemo } from "react";
import { Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import AnimatedNumber from "react-native-animated-numbers";
import { useTheme } from "@/hooks/useRedux";
import { hexToRgba } from "@/utils/helper";
import { safeAmount } from "@/utils/transaction/helpers";
import { getCurrencySymbol } from "@/constants/Currencies";
import GlassPanel from "@/components/global/GlassPanel";
import RingGauge from "@/components/global/RingGauge";

export interface GoalSummitOverviewItem {
  id: string;
  target?: number | string;
  progress?: number | string;
  achieved?: boolean;
}

export interface GoalSummitOverviewProps {
  goals: GoalSummitOverviewItem[];
  currencyCode: string;
}

/**
 * The “Summit Board” — aggregate ascent across all goals. The ring shows
 * total saved ÷ total targets, flanked by the conquered / climbing tally.
 */
const GoalSummitOverview = React.memo(function GoalSummitOverview({
  goals,
  currencyCode,
}: GoalSummitOverviewProps) {
  const { THEME } = useTheme();

  const stats = useMemo(() => {
    let totalTarget = 0;
    let totalSaved = 0;
    let conquered = 0;

    for (const g of goals) {
      const target = safeAmount(g.target);
      const progress = safeAmount(g.progress);
      totalTarget += target;
      totalSaved += progress;
      if (g.achieved || (target > 0 && progress >= target)) conquered++;
    }

    return {
      totalTarget,
      totalSaved,
      conquered,
      climbing: Math.max(0, goals.length - conquered),
      ratio: totalTarget > 0 ? Math.min(1, totalSaved / totalTarget) : 0,
    };
  }, [goals]);

  const percent = Math.round(stats.ratio * 100);

  return (
    <GlassPanel
      glow
      tinted
      padding={16}
      radius={24}
      style={{ marginBottom: 14 }}
    >
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <RingGauge
          size={132}
          strokeWidth={12}
          progress={stats.ratio}
          gradient={[THEME.primary, THEME.secondary]}
          gradientId="summit-overview"
          trackColor={THEME.secondary}
        >
          <View style={{ alignItems: "center" }}>
            <Text
              style={{
                color: THEME.textSecondary,
                fontSize: 10,
                fontWeight: "700",
                letterSpacing: 1,
                textTransform: "uppercase",
              }}
            >
              Saved
            </Text>
            <Text
              style={{
                color: THEME.textPrimary,
                fontSize: 22,
                fontWeight: "900",
                marginTop: 2,
              }}
            >
              {percent}%
            </Text>
          </View>
        </RingGauge>

        {/* Right rail */}
        <View style={{ flex: 1, marginLeft: 20 }}>
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
            Total saved
          </Text>
          <View style={{ flexDirection: "row", alignItems: "baseline" }}>
            <Text
              style={{
                color: THEME.textPrimary,
                fontSize: 19,
                fontWeight: "900",
                marginRight: 3,
              }}
            >
              {getCurrencySymbol(currencyCode)}
            </Text>
            <AnimatedNumber
              includeComma
              animateToNumber={Math.round(stats.totalSaved)}
              animationDuration={700}
              fontStyle={{
                color: THEME.textPrimary,
                fontSize: 26,
                fontWeight: "900",
                letterSpacing: -0.5,
              }}
            />
          </View>
          <Text
            style={{ color: THEME.textSecondary, fontSize: 12, marginBottom: 12 }}
          >
            toward {getCurrencySymbol(currencyCode)}
            {Math.round(stats.totalTarget)} of targets
          </Text>

          {/* Tally */}
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TallyChip
              color={THEME.success}
              icon="award"
              label={`${stats.conquered} conquered`}
            />
            <TallyChip
              color={THEME.primary}
              icon="trending-up"
              label={`${stats.climbing} climbing`}
            />
          </View>
        </View>
      </View>
    </GlassPanel>
  );
});

function TallyChip({
  color,
  icon,
  label,
}: {
  color: string;
  icon: keyof typeof Feather.glyphMap;
  label: string;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: hexToRgba(color, 0.12),
        borderRadius: 999,
        paddingHorizontal: 9,
        paddingVertical: 4,
      }}
    >
      <Feather name={icon} size={11} color={color} style={{ marginRight: 4 }} />
      <Text style={{ color: color, fontSize: 11, fontWeight: "800" }}>{label}</Text>
    </View>
  );
}

export default GoalSummitOverview;