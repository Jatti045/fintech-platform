import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "@/hooks/useRedux";
import { hexToRgba } from "@/utils/colorUtils";
import type { SettingsListProps } from "@/types/profile/types";

/**
 * SettingsList — Security & Account actions matching the approved design system:
 * - Neutral actions (Log Out, Change Password) in a subtle card with dividers.
 * - Destructive action (Delete Account) in a separate restrained danger-tinted card.
 */
export default function SettingsList({ items }: SettingsListProps) {
  const { THEME } = useTheme();
  const destructiveIndex = items.findIndex((i) => i.isDestructive);
  const neutralItems = items.filter((i) => !i.isDestructive);
  const destructiveItem =
    destructiveIndex >= 0 ? items[destructiveIndex] : null;

  return (
    <View style={{ marginBottom: 12 }}>
      {/* Neutral Items Card */}
      <View
        style={{
          backgroundColor: THEME.surface,
          borderRadius: 20,
          borderWidth: 1,
          borderColor: THEME.border,
          overflow: "hidden",
        }}
      >
        {neutralItems.map((item, i) => (
          <View key={`${item.title}-${item.icon}`}>
            <TouchableOpacity
              onPress={item.onPress}
              accessibilityRole="button"
              accessibilityLabel={item.title}
              activeOpacity={0.7}
              style={{
                flexDirection: "row",
                alignItems: "center",
                padding: 14,
              }}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  backgroundColor: THEME.surfaceHover,
                  borderWidth: 1,
                  borderColor: THEME.border,
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: 12,
                }}
              >
                <Ionicons
                  name={item.icon as any}
                  size={17}
                  color={THEME.textPrimary}
                />
              </View>

              <Text
                style={{
                  color: THEME.textPrimary,
                  fontSize: 14.5,
                  fontWeight: "600",
                  flex: 1,
                }}
              >
                {item.title}
              </Text>

              <Ionicons
                name="chevron-forward"
                size={16}
                color={THEME.textSecondary}
              />
            </TouchableOpacity>

            {i < neutralItems.length - 1 ? (
              <View
                style={{
                  height: 1,
                  marginHorizontal: 14,
                  backgroundColor: THEME.border,
                }}
              />
            ) : null}
          </View>
        ))}
      </View>

      {/* Destructive Item Card */}
      {destructiveItem ? (
        <View
          style={{
            backgroundColor: THEME.surface,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: hexToRgba(THEME.danger, 0.25),
            marginTop: 10,
            overflow: "hidden",
          }}
        >
          <TouchableOpacity
            onPress={destructiveItem.onPress}
            accessibilityRole="button"
            accessibilityLabel={destructiveItem.title}
            activeOpacity={0.7}
            style={{
              flexDirection: "row",
              alignItems: "center",
              padding: 14,
            }}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                backgroundColor: hexToRgba(THEME.danger, 0.1),
                borderWidth: 1,
                borderColor: hexToRgba(THEME.danger, 0.2),
                alignItems: "center",
                justifyContent: "center",
                marginRight: 12,
              }}
            >
              <Ionicons name="trash-outline" size={17} color={THEME.danger} />
            </View>

            <Text
              style={{
                color: THEME.danger,
                fontSize: 14.5,
                fontWeight: "700",
                flex: 1,
              }}
            >
              {destructiveItem.title}
            </Text>

            <Ionicons name="chevron-forward" size={16} color={THEME.danger} />
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}
