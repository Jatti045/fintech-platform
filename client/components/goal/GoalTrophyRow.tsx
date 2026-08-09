import React from "react";
import { ScrollView, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useRedux";
import { capitalizeFirst, hexToRgba } from "@/utils/helper";
import type { IGoal } from "@/types/goal/types";

export interface GoalTrophyRowProps {
  goals: IGoal[];
}

/**
 * “Hall of Fame” strip — achieved goals rest here as trophies instead of
 * cluttering the climb list. Horizontal scroll keeps even long lists compact.
 */
const GoalTrophyRow = React.memo(function GoalTrophyRow({
  goals,
}: GoalTrophyRowProps) {
  const { THEME } = useTheme();

  if (goals.length === 0) return null;

  return (
    <View style={{ marginBottom: 14 }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8 }}
      >
        {goals.map((goal) => {
          const icon = (goal.icon || "flag") as keyof typeof Feather.glyphMap;
          return (
            <View
              key={goal.id}
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: hexToRgba(THEME.success, 0.12),
                borderColor: hexToRgba(THEME.success, 0.35),
                borderWidth: 1,
                borderRadius: 999,
                paddingLeft: 12,
                paddingRight: 14,
                paddingVertical: 8,
              }}
            >
              <View
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 13,
                  backgroundColor: THEME.success,
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: 8,
                }}
              >
                <Feather name={icon} size={13} color={THEME.textPrimary} />
              </View>
              <View>
                <Text
                  style={{ color: THEME.success, fontSize: 12, fontWeight: "800" }}
                  numberOfLines={1}
                >
                  {capitalizeFirst(goal.name)}
                </Text>
              </View>
              <Feather
                name="check-circle"
                size={14}
                color={THEME.success}
                style={{ marginLeft: 8 }}
              />
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
});

export default GoalTrophyRow;