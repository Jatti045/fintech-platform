import React, { useEffect } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "@/hooks/useRedux";
import { capitalizeFirst, formatCurrency, hexToRgba } from "@/utils/helper";
import { safeAmount } from "@/utils/transaction/helpers";
import {
  calcGoalPace,
  completionEstimateLabel,
} from "@/utils/goal/goalCalculations";
import type { IGoal } from "@/types/goal/types";
import { hapticLight } from "@/utils/haptics";
import SwipeableRow from "@/components/global/SwipeableRow";
import GlassPanel from "@/components/global/GlassPanel";
import Expandable from "@/components/global/Expandable";

export interface GoalSummitRowProps {
  goal: IGoal;
  currency: string;
  expanded: boolean;
  onToggle: (goal: IGoal) => void;
  onEdit: (goal: IGoal) => void;
  onAllocate: (goal: IGoal) => void;
  onDeallocate: (goal: IGoal) => void;
  onDelete: (goal: IGoal) => void;
}

const TRACK_HEIGHT = 64;
const TRACK_BOTTOM = 10;
const BADGE_HALF = 17;

function progressQuote(percent: number): string {
  if (percent >= 90) return "The summit is right there — push!";
  if (percent >= 60) return "Great momentum — the peak is in sight.";
  if (percent >= 25) return "Solid progress — keep this pace going.";
  return "Every climb starts with a first step.";
}

/**
 * The Climb — an in-flight goal rendered as an altimeter on a vertical
 * trail: a liquid climb-bar with milestone ticks, a peak badge that rises
 * with progress, a pace-derived completion estimate, and an expandable
 * drawer for allocation and maintenance actions.
 */
const GoalSummitRow = React.memo(function GoalSummitRow({
  goal,
  currency,
  expanded,
  onToggle,
  onEdit,
  onAllocate,
  onDeallocate,
  onDelete,
}: GoalSummitRowProps) {
  const { THEME } = useTheme();

  const target = safeAmount(goal.target);
  const progress = safeAmount(goal.progress);
  const remaining = Math.max(0, target - progress);
  const ratio = target > 0 ? Math.max(0, Math.min(1, progress / target)) : 0;
  const percent = Math.round(ratio * 100);
  const achieved = goal.achieved || remaining <= 0;

  const pace = calcGoalPace(goal);
  const estimate = completionEstimateLabel(pace);

  const gradient: [string, string] =
    percent >= 80 && !achieved
      ? [THEME.warning, THEME.primary]
      : [THEME.primary, THEME.secondary];
  const accent = achieved ? THEME.success : THEME.primary;

  // Synced on the UI thread: climb-bar height + peak badge position.
  const fill = useSharedValue(0);
  useEffect(() => {
    fill.value = withSpring(ratio, { damping: 18, stiffness: 110 });
  }, [ratio, fill]);
  const fillStyle = useAnimatedStyle(() => ({
    height: `${fill.value * 100}%`,
  }));
  const badgeStyle = useAnimatedStyle(() => ({
    bottom: TRACK_BOTTOM + fill.value * TRACK_HEIGHT - BADGE_HALF,
  }));

  const rotate = useSharedValue(0);
  useEffect(() => {
    rotate.value = withTiming(expanded ? 180 : 0, {
      duration: 260,
      easing: Easing.out(Easing.cubic),
    });
  }, [expanded, rotate]);
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotate.value}deg` }],
  }));

  const safeIcon = (goal.icon || "flag") as keyof typeof Feather.glyphMap;

  return (
    <SwipeableRow
      onDelete={() => onDelete(goal)}
      dangerColor={THEME.danger}
      actionStyle={{ marginBottom: 12, borderRadius: 18 }}
    >
      <GlassPanel radius={18} padding={0} style={{ marginBottom: 12 }}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => {
            hapticLight();
            onToggle(goal);
          }}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          accessibilityLabel={`${goal.name}, ${percent}% saved`}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              padding: 14,
            }}
          >
<View
              style={{
                width: 44,
                alignItems: "center",
                marginRight: 12,
                height: TRACK_HEIGHT + 34,
              }}
            >
              {/* Peak badge (rises with progress) */}
              <Animated.View
                style={[
                  badgeStyle,
                  {
                    position: "absolute",
                    width: 34,
                    height: 34,
                    borderRadius: 17,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: hexToRgba(accent, 0.16),
                    borderWidth: 1,
                    borderColor: hexToRgba(accent, 0.4),
                  },
                ]}
              >
                <Feather name={safeIcon} size={15} color={accent} />
              </Animated.View>

              {/* Climb track */}
              <View
                style={{
                  position: "absolute",
                  bottom: TRACK_BOTTOM,
                  width: 5,
                  height: TRACK_HEIGHT,
                  borderRadius: 3,
                  backgroundColor: hexToRgba(THEME.border, 0.9),
                  overflow: "hidden",
                }}
              >
                <Animated.View style={[fillStyle, { width: "100%" }]}>
                  <LinearGradient
                    colors={gradient}
                    start={{ x: 0, y: 1 }}
                    end={{ x: 0, y: 0 }}
                    style={{ flex: 1 }}
                  />
                </Animated.View>
              </View>

              {/* Milestone ticks 25 / 50 / 75 */}
              {[0.25, 0.5, 0.75].map((t) => (
                <View
                  key={t}
                  style={{
                    position: "absolute",
                    bottom: TRACK_BOTTOM + TRACK_HEIGHT * t - 1.5,
                    left: 12,
                    width: 3,
                    height: 3,
                    borderRadius: 1.5,
                    backgroundColor: hexToRgba(THEME.textSecondary, 0.55),
                  }}
                />
              ))}

              {/* Base dot */}
              <View
                style={{
                  position: "absolute",
                  bottom: TRACK_BOTTOM - 4,
                  left: 19,
                  width: 9,
                  height: 9,
                  borderRadius: 4.5,
                  backgroundColor: THEME.textDisabled,
                }}
              />
            </View>

            {/* Goal copy */}
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Text
                  style={{ color: THEME.textPrimary, fontSize: 15, fontWeight: "800", flex: 1 }}
                  numberOfLines={1}
                >
                  {capitalizeFirst(goal.name)}
                </Text>
                {estimate && !achieved ? (
                  <View
                    style={{
                      borderRadius: 999,
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                      backgroundColor: hexToRgba(accent, 0.12),
                      marginLeft: 6,
                    }}
                  >
                    <Text style={{ color: accent, fontSize: 10, fontWeight: "800" }}>
                      {estimate} left
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text
                style={{ color: THEME.textSecondary, fontSize: 12, marginTop: 2 }}
                numberOfLines={1}
              >
                {formatCurrency(progress, currency)} of{" "}
                {formatCurrency(target, currency)}
              </Text>
            </View>

            {/* Percent + chevron */}
            <View style={{ alignItems: "flex-end", marginLeft: 10 }}>
              <Text style={{ color: accent, fontSize: 16, fontWeight: "900" }}>
                {percent}%
              </Text>
              <Animated.View style={[chevronStyle, { marginTop: 4 }]}>
                <Feather name="chevron-down" size={16} color={THEME.textSecondary} />
              </Animated.View>
            </View>
          </View>
        </TouchableOpacity>
        <Drawer
          expanded={expanded}
          achieved={achieved}
          percent={percent}
          remaining={remaining}
          weeklyContribution={pace.weeklyContribution}
          daysActive={pace.daysActive}
          quote={progressQuote(percent)}
          currency={currency}
          onEdit={() => onEdit(goal)}
          onAllocate={() => onAllocate(goal)}
          onDeallocate={() => onDeallocate(goal)}
          onDelete={() => onDelete(goal)}
        />
      </GlassPanel>
    </SwipeableRow>
  );
});

interface DrawerProps {
  expanded: boolean;
  achieved: boolean;
  percent: number;
  remaining: number;
  weeklyContribution: number | null;
  daysActive: number;
  quote: string;
  currency: string;
  onEdit: () => void;
  onAllocate: () => void;
  onDeallocate: () => void;
  onDelete: () => void;
}

/** Expanded drawer: pace stats, a progress nudge and quick actions. */
function Drawer({
  expanded,
  achieved,
  percent,
  remaining,
  weeklyContribution,
  daysActive,
  quote,
  currency,
  onEdit,
  onAllocate,
  onDeallocate,
  onDelete,
}: DrawerProps) {
  const { THEME } = useTheme();
  return (
    <Expandable expanded={expanded}>
      <View
        style={{
          marginHorizontal: 14,
          borderTopWidth: 1,
          borderTopColor: hexToRgba(THEME.border, 0.8),
          paddingBottom: 14,
          paddingTop: 12,
        }}
      >
        {/* Stat tiles */}
        <View style={{ flexDirection: "row", gap: 10, marginBottom: 10 }}>
          <MetricTile
            label="Weekly avg"
            value={
              weeklyContribution != null
                ? formatCurrency(weeklyContribution, currency)
                : "—"
            }
          />
          <MetricTile label="Going" value={`${daysActive}d`} />
          <MetricTile
            label="Remaining"
            value={formatCurrency(Math.max(0, remaining), currency)}
            accent={achieved ? THEME.success : THEME.textPrimary}
          />
        </View>

        {/* Progress nudge */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: hexToRgba(THEME.primary, 0.08),
            borderRadius: 10,
            paddingHorizontal: 10,
            paddingVertical: 8,
            marginBottom: 12,
          }}
        >
          <Feather
            name={achieved ? "award" : "zap"}
            size={13}
            color={achieved ? THEME.success : THEME.primary}
            style={{ marginRight: 6 }}
          />
          <Text
            style={{
              color: achieved ? THEME.success : THEME.textSecondary,
              fontSize: 12,
              fontWeight: "600",
              flex: 1,
            }}
          >
            {achieved ? "Goal conquered — brilliant work." : quote}
          </Text>
        </View>

        {/* Quick actions */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          {!achieved ? (
            <>
              <ActionButton label="Allocate" icon="plus" onPress={onAllocate} color={THEME.primary} solid />
              <ActionButton label="Withdraw" icon="minus" onPress={onDeallocate} color={THEME.primary} />
              <ActionButton label="Edit" icon="edit-3" onPress={onEdit} color={THEME.textSecondary} />
            </>
          ) : null}
          <ActionButton label="Delete" icon="trash-2" onPress={onDelete} color={THEME.danger} />
        </View>
      </View>
    </Expandable>
  );
}

function MetricTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  const { THEME } = useTheme();
  return (
    <View style={{ flex: 1, minWidth: 70 }}>
      <Text
        style={{
          color: THEME.textSecondary,
          fontSize: 10,
          fontWeight: "700",
          letterSpacing: 0.3,
          textTransform: "uppercase",
          marginBottom: 3,
        }}
      >
        {label}
      </Text>
      <Text
        style={{ color: accent ?? THEME.textPrimary, fontSize: 14, fontWeight: "800" }}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>
    </View>
  );
}

function ActionButton({
  label,
  icon,
  onPress,
  color,
  solid = false,
}: {
  label: string;
  icon: keyof typeof Feather.glyphMap;
  onPress: () => void;
  color: string;
  solid?: boolean;
}) {
  const { THEME } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        flex: 1,
        minWidth: 132,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 10,
        borderRadius: 12,
        backgroundColor: solid ? color : hexToRgba(color, 0.1),
        borderWidth: solid ? 0 : 1,
        borderColor: hexToRgba(color, 0.5),
      }}
    >
      <Feather
        name={icon}
        size={15}
        color={solid ? THEME.textPrimary : color}
        style={{ marginRight: 6 }}
      />
      <Text style={{ color: solid ? THEME.textPrimary : color, fontSize: 13, fontWeight: "800" }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export default GoalSummitRow;