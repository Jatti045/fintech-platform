import React from "react";
import { Switch, Text, TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";

import { useTheme } from "@/hooks/useRedux";
import { hexToRgba } from "@/utils/colorUtils";
import type { ITheme } from "@/types/theme/types";

interface NotificationPreferenceProps {
  THEME?: ITheme;
  enabled: boolean;
  permissionDenied: boolean;
  onToggle: (enabled: boolean) => void;
  onOpenSettings: () => void;
  /** Row title. Defaults to the purchase-reminder copy. */
  title?: string;
  /** Row subtitle shown when permission is granted. */
  subtitle?: string;
}

/**
 * Renders a notification preference on a subtle surface with a switch.
 * The switch reflects the *effective* state: when the OS has denied
 * permission, it is shown off and disabled (never a fake "on" toggle), and an
 * "Open Settings" action is offered so the user can grant permission at the
 * system level.
 */
export default function NotificationPreference({
  THEME: propTheme,
  enabled,
  permissionDenied,
  onToggle,
  onOpenSettings,
  title = "Purchase Reminders",
  subtitle = "A gentle nudge at 12 PM and 6 PM to log your purchases.",
}: NotificationPreferenceProps) {
  const { THEME: reduxTheme } = useTheme();
  const theme = propTheme || reduxTheme;

  return (
    <View
      style={{
        backgroundColor: theme.surface,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: theme.border,
        padding: 16,
        marginBottom: 8,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <View
          style={{
            width: 38,
            height: 38,
            borderRadius: 12,
            backgroundColor: hexToRgba(theme.primary, 0.12),
            borderWidth: 1,
            borderColor: hexToRgba(theme.primary, 0.25),
            alignItems: "center",
            justifyContent: "center",
            marginRight: 12,
          }}
        >
          <Feather name="bell" size={17} color={theme.primary} />
        </View>

        <View style={{ flex: 1, paddingRight: 8 }}>
          <Text
            style={{
              color: theme.textPrimary,
              fontSize: 15,
              fontWeight: "700",
            }}
          >
            {title}
          </Text>
          <Text
            style={{
              color: theme.textSecondary,
              fontSize: 12,
              marginTop: 2,
              lineHeight: 16,
            }}
          >
            {permissionDenied
              ? "Notifications are off for Budgee in device settings. Turn them on there to receive reminders."
              : subtitle}
          </Text>
        </View>

        <Switch
          value={permissionDenied ? false : enabled}
          disabled={permissionDenied}
          onValueChange={onToggle}
          trackColor={{ false: theme.border, true: theme.primary }}
          thumbColor="#FFFFFF"
        />
      </View>

      {permissionDenied ? (
        <TouchableOpacity
          onPress={onOpenSettings}
          activeOpacity={0.75}
          style={{
            marginTop: 14,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            paddingVertical: 10,
            borderRadius: 12,
            backgroundColor: theme.surfaceHover,
            borderWidth: 1,
            borderColor: theme.border,
          }}
          accessibilityRole="button"
          accessibilityLabel="Open Settings"
        >
          <Feather
            name="settings"
            size={14}
            color={theme.primary}
            style={{ marginRight: 6 }}
          />
          <Text
            style={{ color: theme.primary, fontWeight: "700", fontSize: 13 }}
          >
            Open Settings
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}
