import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import GlassPanel from "@/components/global/GlassPanel";
import { hexToRgba } from "@/utils/helper";
import type { SettingsListProps } from "@/types/profile/types";

/**
 * SettingsList — a grouped glass list framing the account actions. The
 * destructive “Delete Account” action is separated from the neutral ones.
 */
export default function SettingsList({ THEME, items }: SettingsListProps) {
  const destructiveIndex = items.findIndex((i) => i.isDestructive);
  const neutralItems = items.filter((i) => !i.isDestructive);
  const destructiveItem =
    destructiveIndex >= 0 ? items[destructiveIndex] : null;

  return (
    <View>
      <Text
        style={{
          color: THEME.textSecondary,
          fontSize: 11,
          fontWeight: "700",
          letterSpacing: 0.6,
          textTransform: "uppercase",
          marginBottom: 8,
          marginTop: 4,
        }}
      >
        Security & Account
      </Text>

      <GlassPanel padding={0} radius={18} style={{ marginBottom: 12 }}>
        {neutralItems.map((item, i) => (
          <View key={`${item.title}-${item.icon}`}>
            <SettingRow
              title={item.title}
              icon={item.icon}
              THEME={THEME}
              onPress={item.onPress}
              isDestructive={false}
            />
            {i < neutralItems.length - 1 ? (
              <View
                style={{
                  height: 1,
                  marginHorizontal: 14,
                  backgroundColor: hexToRgba(THEME.border, 0.7),
                }}
              />
            ) : null}
          </View>
        ))}
      </GlassPanel>

      {destructiveItem ? (
        <GlassPanel
          padding={0}
          radius={18}
          style={{ marginBottom: 12, borderColor: hexToRgba(THEME.danger, 0.4) }}
        >
          <SettingRow
            title={destructiveItem.title}
            icon={destructiveItem.icon}
            THEME={THEME}
            onPress={destructiveItem.onPress}
            isDestructive
          />
        </GlassPanel>
      ) : null}
    </View>
  );
}

function SettingRow({
  title,
  icon,
  THEME,
  onPress,
  isDestructive,
}: {
  title: string;
  icon: string;
  THEME: SettingsListProps["THEME"];
  onPress: () => void;
  isDestructive: boolean;
}) {
  const color = isDestructive ? THEME.danger : THEME.textPrimary;
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      activeOpacity={0.7}
      style={{ flexDirection: "row", alignItems: "center", padding: 14 }}
    >
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 11,
          backgroundColor: hexToRgba(color, 0.14),
          alignItems: "center",
          justifyContent: "center",
          marginRight: 12,
        }}
      >
        <Ionicons name={icon as any} size={17} color={color} />
      </View>
      <Text style={{ color, fontSize: 15, fontWeight: "700", flex: 1 }}>
        {title}
      </Text>
      <Ionicons
        name="chevron-forward"
        size={18}
        color={isDestructive ? THEME.danger : THEME.textSecondary}
      />
    </TouchableOpacity>
  );
}
