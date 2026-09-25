import React from "react";
import { View, Text, Switch, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";

import { useTheme } from "@/hooks/useRedux";
import { hexToRgba } from "@/utils/colorUtils";

interface NotificationsCardProps {
  purchaseRemindersEnabled: boolean;
  billRemindersEnabled: boolean;
  notificationPermissionDenied: boolean;
  onTogglePurchaseReminders: (val: boolean) => void;
  onToggleBillReminders: (val: boolean) => void;
  onOpenSettings: () => void;
}

/**
 * Dedicated Notifications card matching the approved mockup:
 * - Row 1: Purchase Reminders (with switch)
 * - Subtle divider
 * - Row 2: Upcoming Bill Reminders (with switch)
 * - Wide understated "Open Settings" button with settings icon
 */
export default function NotificationsCard({
  purchaseRemindersEnabled,
  billRemindersEnabled,
  notificationPermissionDenied,
  onTogglePurchaseReminders,
  onToggleBillReminders,
  onOpenSettings,
}: NotificationsCardProps) {
  const { THEME } = useTheme();

  return (
    <View
      style={{
        backgroundColor: THEME.surface,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: THEME.border,
        padding: 16,
        marginBottom: 8,
      }}
    >
      {/* ── Row 1: Purchase Reminders ─────────────────────────────────── */}
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <View
          style={{
            width: 38,
            height: 38,
            borderRadius: 12,
            backgroundColor: hexToRgba(THEME.primary, 0.12),
            borderWidth: 1,
            borderColor: hexToRgba(THEME.primary, 0.25),
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
              fontWeight: "700",
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
            {notificationPermissionDenied
              ? "Notifications are off for Budgee in device settings. Turn them on there to receive reminders."
              : "Get notified about recurring and upcoming purchases."}
          </Text>
        </View>

        <Switch
          value={
            notificationPermissionDenied ? false : purchaseRemindersEnabled
          }
          disabled={notificationPermissionDenied}
          onValueChange={onTogglePurchaseReminders}
          trackColor={{ false: THEME.border, true: THEME.primary }}
          thumbColor="#FFFFFF"
        />
      </View>

      {/* ── Subtle Divider ────────────────────────────────────────────── */}
      <View
        style={{
          height: 1,
          backgroundColor: THEME.border,
          marginVertical: 14,
        }}
      />

      {/* ── Row 2: Upcoming Bill Reminders ────────────────────────────── */}
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <View
          style={{
            width: 38,
            height: 38,
            borderRadius: 12,
            backgroundColor: hexToRgba(THEME.primary, 0.12),
            borderWidth: 1,
            borderColor: hexToRgba(THEME.primary, 0.25),
            alignItems: "center",
            justifyContent: "center",
            marginRight: 12,
          }}
        >
          <Feather name="calendar" size={17} color={THEME.primary} />
        </View>

        <View style={{ flex: 1, paddingRight: 8 }}>
          <Text
            style={{
              color: THEME.textPrimary,
              fontSize: 15,
              fontWeight: "700",
            }}
          >
            Upcoming Bill Reminders
          </Text>
          <Text
            style={{
              color: THEME.textSecondary,
              fontSize: 12,
              marginTop: 2,
              lineHeight: 16,
            }}
          >
            {notificationPermissionDenied
              ? "Notifications are off for Budgee in device settings. Turn them on there to receive reminders."
              : "Get notified about upcoming bills and payments."}
          </Text>
        </View>

        <Switch
          value={notificationPermissionDenied ? false : billRemindersEnabled}
          disabled={notificationPermissionDenied}
          onValueChange={onToggleBillReminders}
          trackColor={{ false: THEME.border, true: THEME.primary }}
          thumbColor="#FFFFFF"
        />
      </View>

      {/* ── Open Settings Button ──────────────────────────────────────── */}
      <TouchableOpacity
        onPress={onOpenSettings}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel="Open Settings"
        style={{
          marginTop: 16,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          paddingVertical: 11,
          borderRadius: 12,
          backgroundColor: THEME.surfaceHover,
          borderWidth: 1,
          borderColor: THEME.border,
        }}
      >
        <Feather
          name="settings"
          size={14}
          color={THEME.primary}
          style={{ marginRight: 8 }}
        />
        <Text style={{ color: THEME.primary, fontWeight: "700", fontSize: 13 }}>
          Open Settings
        </Text>
      </TouchableOpacity>
    </View>
  );
}
