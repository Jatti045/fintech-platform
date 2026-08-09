import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "@/hooks/useRedux";
import GlassPanel from "@/components/global/GlassPanel";

type Props = {
  /** Called after the guard check passes (budget exists for this month). */
  onNewTransaction: () => void;
  onNewBudget: () => void;
};

/**
 * Quick actions — glass command tiles for the two most common actions.
 */
export default function QuickActions({ onNewTransaction, onNewBudget }: Props) {
  const { THEME } = useTheme();

  return (
    <View style={{ marginBottom: 14 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          marginTop: 6,
          marginBottom: 12,
        }}
      >
        <View
          style={{
            width: 22,
            height: 2,
            borderRadius: 1,
            backgroundColor: THEME.primary,
            marginRight: 10,
          }}
        />
        <Text
          style={{
            color: THEME.textPrimary,
            fontSize: 14,
            fontWeight: "800",
            letterSpacing: 0.4,
            textTransform: "uppercase",
          }}
        >
          Quick actions
        </Text>
        <View
          style={{ flex: 1, height: 1, backgroundColor: THEME.border, marginLeft: 12 }}
        />
      </View>

      <View style={{ flexDirection: "row", gap: 12 }}>
        <ActionTile
          label="New Transaction"
          hint="Log spending"
          icon="plus-circle"
          onPress={onNewTransaction}
          colors={[THEME.primary, THEME.secondary]}
        />
        <ActionTile
          label="New Budget"
          hint="Set a limit"
          icon="target"
          onPress={onNewBudget}
          colors={[THEME.secondary, THEME.primary]}
        />
      </View>
    </View>
  );
}

function ActionTile({
  label,
  hint,
  icon,
  onPress,
  colors,
}: {
  label: string;
  hint: string;
  icon: keyof typeof Feather.glyphMap;
  onPress: () => void;
  colors: [string, string];
}) {
  const { THEME } = useTheme();
  return (
    <GlassPanel padding={14} radius={18} style={{ flex: 1 }}>
      <TouchableOpacity onPress={onPress} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel={label}>
        <LinearGradient
          colors={colors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 12,
          }}
        >
          <Feather name={icon} size={20} color={THEME.textPrimary} />
        </LinearGradient>
        <Text style={{ color: THEME.textPrimary, fontSize: 14, fontWeight: "800" }}>
          {label}
        </Text>
        <Text style={{ color: THEME.textSecondary, fontSize: 11, marginTop: 3 }}>
          {hint}
        </Text>
      </TouchableOpacity>
    </GlassPanel>
  );
}
