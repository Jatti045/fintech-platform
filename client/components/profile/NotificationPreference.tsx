import React from "react";
import { Switch, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";

import { hexToRgba } from "@/utils/helper";
import type { ITheme } from "@/types/theme/types";

import GlassPanel from "@/components/global/GlassPanel";

interface NotificationPreferenceProps {
  THEME: ITheme;
  enabled: boolean;
  permissionDenied: boolean;
  onToggle: (enabled: boolean) => void;
}

/**
 * Renders the purchase-reminder preference on a subtle glass surface with a
 * switch. Self-contained (uses the passed THEME prop) so it stays simple and
 * easy to test.
 */
export default function NotificationPreference({
  THEME,
  enabled,
  permissionDenied,
  onToggle,
}: NotificationPreferenceProps) {
  return (
    <GlassPanel padding={14} radius={18} style={{ marginBottom: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <View
          style={{
            width: 38,
            height: 38,
            borderRadius: 12,
            backgroundColor: hexToRgba(THEME.primary, 0.14),
            alignItems: "center",
            justifyContent: "center",
            marginRight: 12,
          }}
        >
          <Feather name="bell" size={17} color={THEME.primary} />
        </View>
        <View style={{ flex: 1, paddingRight: 8 }}>
          <Text
            style={{
              color: THEME.textPrimary,
              fontSize: 15,
              fontWeight: "800",
            }}
          >
            Purchase Reminders
          </Text>
          <Text
            style={{
              color: THEME.textSecondary,
              fontSize: 12,
              marginTop: 2,
              lineHeight: 16,
            }}
          >
            {permissionDenied
              ? "Notifications are off for Budgee in device settings, so reminders won’t be delivered."
              : "A gentle nudge at 12 PM and 6 PM to log your purchases."}
          </Text>
        </View>
        <Switch
          value={enabled}
          onValueChange={onToggle}
          trackColor={{ false: THEME.border, true: THEME.primary }}
          thumbColor={THEME.surface}
        />
      </View>
    </GlassPanel>
  );
}
