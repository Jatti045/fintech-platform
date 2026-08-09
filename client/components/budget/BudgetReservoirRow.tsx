import React, { useEffect } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { useTheme } from "@/hooks/useRedux";
import { capitalizeFirst, formatCurrency, hexToRgba } from "@/utils/helper";
import { safeAmount } from "@/utils/transaction/helpers";
import {
  overspendDeltaCents,
  utilizationTier,
  type UtilizationTier,
} from "@/utils/budget/budgetCalculations";
import type { IBudget } from "@/types/budget/types";
import { hapticLight } from "@/utils/haptics";
import SwipeableRow from "@/components/global/SwipeableRow";
import GlassPanel from "@/components/global/GlassPanel";
import SpringFill from "@/components/global/SpringFill";
import Expandable from "@/components/global/Expandable";

export interface BudgetReservoirRowProps {
  budget: IBudget;
  displayLimit?: number;
  displaySpent?: number;
  currencyCode?: string;
  expanded: boolean;
  onToggle: (budget: IBudget) => void;
  onEdit: (budget: IBudget) => void;
  onDelete: (id: string) => void;
}

function tierColor(
  tier: UtilizationTier,
  theme: ReturnType<typeof useTheme>["THEME"],
): string {
  if (tier === "over") return theme.danger;
  if (tier === "warm") return theme.warning;
  return theme.primary;
}

function tierGradient(
  tier: UtilizationTier,
  theme: ReturnType<typeof useTheme>["THEME"],
): [string, string] {
  if (tier === "over") return [theme.danger, theme.warning];
  if (tier === "warm") return [theme.warning, theme.primary];
  return [theme.primary, theme.secondary];
}

/**
 * Reservoir row — the budget list re-imagined as a liquid segment rather
 * than a card. Tap to expand the drawer (remaining, overspend warning,
 * edit/delete); swipe left to delete.
 */
const BudgetReservoirRow = React.memo(function BudgetReservoirRow({
  budget,
  displayLimit,
  displaySpent,
  currencyCode = "USD",
  expanded,
  onToggle,
  onEdit,
  onDelete,
}: BudgetReservoirRowProps) {
  const { THEME } = useTheme();

  const limit = safeAmount(displayLimit ?? budget.limit);
  const spent = safeAmount(displaySpent ?? budget.spent);
  const ratio = limit > 0 ? spent / limit : 0;
  const percent = Math.min(999, Math.round(ratio * 100));
  const tier = utilizationTier(ratio);
  const overspent = spent > limit && limit > 0;
  const remaining = Math.max(0, limit - spent);

  const accent = tierColor(tier, THEME);
  const gradient = tierGradient(tier, THEME);

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

  const safeIcon = (budget.icon || "circle") as keyof typeof Feather.glyphMap;

  return (
    <SwipeableRow
      onDelete={() => onDelete(budget.id)}
      dangerColor={THEME.danger}
      actionStyle={{ marginBottom: 12, borderRadius: 18 }}
    >
      <GlassPanel radius={18} padding={0} style={{ marginBottom: 12 }}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => {
            hapticLight();
            onToggle(budget);
          }}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          accessibilityLabel={`${capitalizeFirst(budget.category)} budget, ${percent}% used`}
        >
          <View style={{ padding: 14, paddingBottom: 0 }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <View
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 14,
                  backgroundColor: hexToRgba(accent, 0.16),
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: 12,
                }}
              >
                <Feather name={safeIcon} size={19} color={accent} />
              </View>

              <View style={{ flex: 1 }}>
                <Text
                  style={{ color: THEME.textPrimary, fontSize: 15, fontWeight: "800" }}
                  numberOfLines={1}
                >
                  {capitalizeFirst(budget.category)}
                </Text>
                <Text
                  style={{ color: THEME.textSecondary, fontSize: 12, marginTop: 2 }}
                  numberOfLines={1}
                >
                  {formatCurrency(spent, currencyCode)} of{" "}
                  {formatCurrency(limit, currencyCode)}
                </Text>
              </View>

              <View style={{ alignItems: "flex-end", marginLeft: 10 }}>
                <Text style={{ color: accent, fontSize: 16, fontWeight: "900" }}>
                  {percent}%
                </Text>
                <Animated.View style={[chevronStyle, { marginTop: 4 }]}>
                  <Feather name="chevron-down" size={16} color={THEME.textSecondary} />
                </Animated.View>
              </View>
            </View>
          </View>

          <View style={{ paddingHorizontal: 14, marginTop: 12 }}>
            <SpringFill
              ratio={Math.min(1, ratio)}
              trackColor={hexToRgba(THEME.border, 0.8)}
              colors={gradient}
              height={7}
            />
          </View>
          <View style={{ height: 14 }} />
        </TouchableOpacity>
<Drawer
          expanded={expanded}
          percent={percent}
          remaining={remaining}
          overspent={overspent}
          overspendAmount={overspendDeltaCents(limit, spent)}
          currencyCode={currencyCode}
          onEdit={() => onEdit(budget)}
          onDelete={() => onDelete(budget.id)}
        />
      </GlassPanel>
    </SwipeableRow>
  );
});

interface DrawerProps {
  expanded: boolean;
  percent: number;
  remaining: number;
  overspent: boolean;
  overspendAmount: number;
  currencyCode: string;
  onEdit: () => void;
  onDelete: () => void;
}

/** Expanded drawer: remaining, overspend warning and quick actions. */
function Drawer({
  expanded,
  percent,
  remaining,
  overspent,
  overspendAmount,
  currencyCode,
  onEdit,
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
        {/* Overspend banner */}
        {overspent && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: hexToRgba(THEME.danger, 0.1),
              borderRadius: 10,
              paddingHorizontal: 10,
              paddingVertical: 8,
              marginBottom: 12,
            }}
          >
            <Feather name="alert-triangle" size={14} color={THEME.danger} style={{ marginRight: 6 }} />
            <Text style={{ color: THEME.danger, fontSize: 12, fontWeight: "700", flex: 1 }}>
              Exceeded by {formatCurrency(overspendAmount, currencyCode)}
            </Text>
          </View>
        )}

        {/* Metric tiles */}
        <View style={{ flexDirection: "row", gap: 10, marginBottom: 12 }}>
          <MetricTile
            label="Still available"
            value={overspent ? "—" : formatCurrency(remaining, currencyCode)}
            accent={overspent ? THEME.danger : THEME.success}
          />
          <MetricTile
            label="Of your limit"
            value={`${percent}%`}
            accent={THEME.textPrimary}
          />
        </View>

        {/* Quick actions */}
        <View style={{ flexDirection: "row", gap: 10 }}>
          <ActionButton
            label="Edit"
            icon="edit-3"
            onPress={onEdit}
            color={THEME.primary}
            solid
          />
          <ActionButton
            label="Delete"
            icon="trash-2"
            onPress={onDelete}
            color={THEME.danger}
          />
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
  accent: string;
}) {
  const { THEME } = useTheme();
  return (
    <View style={{ flex: 1 }}>
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
      <Text style={{ color: accent, fontSize: 15, fontWeight: "800" }} numberOfLines={1}>
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
      <Feather name={icon} size={15} color={solid ? THEME.textPrimary : color} style={{ marginRight: 6 }} />
      <Text style={{ color: solid ? THEME.textPrimary : color, fontSize: 13, fontWeight: "800" }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export default BudgetReservoirRow;