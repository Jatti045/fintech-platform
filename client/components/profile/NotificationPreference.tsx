import React from "react";
import { Switch, Text, View } from "react-native";

import type { ITheme } from "@/types/theme/types";

interface NotificationPreferenceProps {
  THEME: ITheme;
  enabled: boolean;
  /**
   * Whether notifications are currently not permitted on this device (e.g.
   * the user denied permission). Kept informational only — the switch stays
   * usable so the user is never blocked, but we explain why reminders won't
   * be delivered until notifications are enabled in device settings.
   */
  permissionDenied: boolean;
  onToggle: (enabled: boolean) => void;
}

/**
 * Renders the purchase-reminder preference row in the Profile settings.
 * A simple master switch: on schedules the daily reminders, off cancels them.
 *
 * The switch is always interactive. When notifications aren't permitted we
 * show a hint instead of disabling it, so the user can still manage their
 * preference and is guided to re-enable notifications in device settings.
 */
export default function NotificationPreference({
  THEME,
  enabled,
  permissionDenied,
  onToggle,
}: NotificationPreferenceProps) {
  return (
    <View
      style={{
        backgroundColor: THEME.inputBackground,
        borderColor: THEME.border,
      }}
      className="rounded-2xl p-4 border mb-4"
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-1 pr-4">
          <Text
            style={{ color: THEME.textPrimary }}
            className="text-base font-semibold"
          >
            Purchase Reminders
          </Text>
          <Text style={{ color: THEME.textSecondary }} className="mt-1 text-sm">
            {permissionDenied
              ? "Notifications are turned off for Budgee in your device settings, so reminders won't be delivered."
              : "Get a gentle reminder at 12&nbsp;PM and 6&nbsp;PM to log your purchases."}
          </Text>
        </View>
        <Switch
          value={enabled}
          onValueChange={onToggle}
          trackColor={{ false: THEME.border, true: THEME.primary }}
          thumbColor={THEME.surface}
        />
      </View>
    </View>
  );
}
