import React from "react";
import { Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useRedux";
import { hexToRgba } from "@/utils/helper";

/**
 * Minimal, quiet empty state for the Goals screen. A small icon and two
 * short lines communicate that no goals exist yet, with a subtle pointer
 * to the create action. Intentionally unobtrusive.
 */
const EmptyGoalState = React.memo(function EmptyGoalState() {
  const { THEME } = useTheme();

  return (
    <View
      style={{
        alignItems: "center",
        paddingVertical: 48,
        paddingHorizontal: 24,
      }}
    >
      <View
        style={{
          width: 46,
          height: 46,
          borderRadius: 15,
          backgroundColor: hexToRgba(THEME.primary, 0.1),
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 14,
        }}
      >
        <Feather name="flag" size={20} color={THEME.primary} />
      </View>

      <Text
        style={{
          color: THEME.textPrimary,
          fontSize: 17,
          fontWeight: "800",
          marginBottom: 6,
        }}
      >
        No goals yet
      </Text>

      <Text
        style={{
          color: THEME.textSecondary,
          fontSize: 13,
          lineHeight: 19,
          textAlign: "center",
          maxWidth: 260,
        }}
      >
        Create a goal to start saving toward something worth it.
      </Text>

      <Text style={{ color: THEME.textSecondary, fontSize: 12, marginTop: 14 }}>
        Tap “New Goal” to get started.
      </Text>
    </View>
  );
});

export default EmptyGoalState;
