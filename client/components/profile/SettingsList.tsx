import React from "react";
import { Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import type { SettingsListProps } from "@/types/profile/types";

/**
 * Renders the list of action-rows (Log Out, Change Password, Delete Account).
 */
export default function SettingsList({ THEME, items }: SettingsListProps) {
  return (
    <>
      {items.map((item) => (
        <TouchableOpacity
          key={`${item.title}-${item.icon}`}
          onPress={item.onPress}
          accessibilityRole="button"
          accessibilityLabel={item.title}
          style={{ backgroundColor: THEME.surface, borderColor: THEME.border, borderWidth: 1 }}
          className="flex-row items-center justify-between p-4 rounded-xl mb-3"
        >
          <Text
            className="font-medium text-base"
            style={{
              color: item.isDestructive ? THEME.danger : THEME.textPrimary,
            }}
          >
            {item.title}
          </Text>
          <Ionicons
            name={item.icon as any}
            size={20}
            color={item.isDestructive ? THEME.danger : THEME.textSecondary}
          />
        </TouchableOpacity>
      ))}
    </>
  );
}
