import React, { useMemo } from "react";
import { Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import AnimatedNumber from "react-native-animated-numbers";
import { useTheme } from "@/hooks/useRedux";
import { formatCurrency, hexToRgba } from "@/utils/helper";
import { getCurrencySymbol } from "@/constants/Currencies";
import GlassPanel from "@/components/global/GlassPanel";
import RingGauge from "@/components/global/RingGauge";

export interface HomePulseProps {
  monthlyIncome: number;
  totalSpent: number;
  monthLabel: string;
  currencyCode: string;
  isCurrentMonth: boolean;
}

type PulseTone = "comfortable" | "onPace" | "warming" | "over" | "idle";

function toneFor(ratio: number, hasIncome: boolean): PulseTone {
  if (!hasIncome) return "idle";
  if (ratio <= 0.5) return "comfortable";
  if (ratio <= 0.75) return "onPace";
  if (ratio <= 1) return "warming";
  return "over";
}

function insightFor(tone: PulseTone, ratio: number): string {
  switch (tone) {
    case "comfortable":
      return `Comfortable — you’ve used ${Math.round(ratio * 100)}% of this month’s income.`;
    case "onPace":
      return `On pace — ${Math.round(ratio * 100)}% of income spent so far.`;
    case "warming":
      return `Warming up — ${Math.round(ratio * 100)}% of income already spent.`;
    case "over":
      return `Spending has outpaced income this month.`;
    default:
      return "Set your monthly income in Profile to read your pulse.";
  }
}

/**
 * The “Pulse” hero — the first thing you see on Home. The ring reads how
 * much of the month’s income has been spent; the centre is your net
 * remaining, and a dynamic insight line tells you how you’re doing.
 */
const HomePulse = React.memo(function HomePulse({
  monthlyIncome,
  totalSpent,
  monthLabel,
  currencyCode,
  isCurrentMonth,
}: HomePulseProps) {
  const { THEME } = useTheme();

  const income = Math.max(0, monthlyIncome || 0);
  const spent = Math.max(0, totalSpent || 0);
  const net = income - spent;
  const hasIncome = income > 0;
  const spentRatio = hasIncome ? Math.max(0, Math.min(1.4, spent / income)) : 0;
  const tone = toneFor(spentRatio, hasIncome);
  const insight = insightFor(tone, spentRatio);
  const netColor =
    tone === "over" ? THEME.danger : net < 0 ? THEME.danger : THEME.success;

  const ringFilled = Math.min(1, spentRatio);

  const { totalIncomeText, totalSpentText } = useMemo(() => {
    return {
      totalIncomeText: formatCurrency(income, currencyCode),
      totalSpentText: formatCurrency(spent, currencyCode),
    };
  }, [income, spent, currencyCode]);

  return (
    <GlassPanel padding={16} radius={24} style={{ marginBottom: 14 }}>
      {/* Top row */}
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
            <Feather name="activity" size={14} color={THEME.primary} />
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
            Your pulse · {monthLabel}
          </Text>
        </View>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: hexToRgba(THEME.surface, 0.6),
            borderRadius: 999,
            paddingHorizontal: 9,
            paddingVertical: 4,
          }}
        >
          <View
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: netColor,
              marginRight: 6,
            }}
          />
          <Text style={{ color: THEME.textSecondary, fontSize: 11 }}>
            {isCurrentMonth ? "Live" : "Month"}
          </Text>
        </View>
      </View>

      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <RingGauge
          size={150}
          strokeWidth={13}
          progress={ringFilled}
          gradient={[THEME.primary, THEME.secondary]}
          gradientId="home-pulse"
          trackColor={tone === "over" ? THEME.danger : THEME.secondary}
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
              Net
            </Text>
            <View style={{ flexDirection: "row", alignItems: "baseline" }}>
              <Text
                style={{
                  color: netColor,
                  fontSize: 18,
                  fontWeight: "900",
                  marginRight: 1,
                }}
              >
                {getCurrencySymbol(currencyCode)}
              </Text>
              <AnimatedNumber
                includeComma
                animateToNumber={Math.round(Math.abs(net))}
                animationDuration={700}
                fontStyle={{
                  color: netColor,
                  fontSize: 24,
                  fontWeight: "900",
                  letterSpacing: -0.5,
                }}
              />
            </View>
            <Text
              style={{ color: THEME.textSecondary, fontSize: 9, marginTop: 2 }}
            >
              {net < 0 ? "over by" : "remaining"}
            </Text>
          </View>
        </RingGauge>

        {/* Right rail: income / spent */}
        <View style={{ flex: 1, marginLeft: 18 }}>
          <PulseStat
            label="Income"
            value={totalIncomeText}
            icon="trending-up"
            color={THEME.success}
          />
          <View style={{ height: 12 }} />
          <PulseStat
            label="Spent"
            value={totalSpentText}
            icon="trending-down"
            color={tone === "over" ? THEME.danger : THEME.textPrimary}
          />
        </View>
      </View>

      {/* Insight banner */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          marginTop: 14,
          borderRadius: 12,
          paddingHorizontal: 12,
          paddingVertical: 10,
          backgroundColor: hexToRgba(
            tone === "over"
              ? THEME.danger
              : tone === "idle"
                ? THEME.textSecondary
                : THEME.primary,
            0.1,
          ),
        }}
      >
        <Feather
          name={
            tone === "over"
              ? "alert-triangle"
              : tone === "idle"
                ? "info"
                : "zap"
          }
          size={14}
          color={
            tone === "over"
              ? THEME.danger
              : tone === "idle"
                ? THEME.textSecondary
                : THEME.primary
          }
          style={{ marginRight: 8 }}
        />
        <Text
          style={{
            color:
              tone === "over"
                ? THEME.danger
                : tone === "idle"
                  ? THEME.textSecondary
                  : THEME.textPrimary,
            fontSize: 12,
            fontWeight: "600",
            flex: 1,
          }}
        >
          {insight}
        </Text>
      </View>
    </GlassPanel>
  );
});

function PulseStat({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string;
  icon: keyof typeof Feather.glyphMap;
  color: string;
}) {
  const { THEME } = useTheme();
  return (
    <View>
      <View
        style={{ flexDirection: "row", alignItems: "center", marginBottom: 2 }}
      >
        <Feather
          name={icon}
          size={12}
          color={color}
          style={{ marginRight: 5 }}
        />
        <Text
          style={{
            color: THEME.textSecondary,
            fontSize: 10,
            fontWeight: "700",
            letterSpacing: 0.6,
            textTransform: "uppercase",
          }}
        >
          {label}
        </Text>
      </View>
      <Text
        style={{ color: color, fontSize: 18, fontWeight: "800" }}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>
    </View>
  );
}

export default HomePulse;
