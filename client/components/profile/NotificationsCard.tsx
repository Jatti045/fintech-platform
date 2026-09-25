import React from "react";
import { View, Text, Switch, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";

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
  return (
    <View
      style={{
        backgroundColor: "#141416",
        borderRadius: 20,
        borderWidth: 1,
        borderColor: "#1F1F23",
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
            backgroundColor: "rgba(212, 175, 106, 0.12)",
            borderWidth: 1,
            borderColor: "rgba(212, 175, 106, 0.25)",
            alignItems: "center",
            justifyContent: "center",
            marginRight: 12,
          }}
        >
          <Feather name="bell" size={17} color="#D4AF6A" />
        </View>

        <View style={{ flex: 1, paddingRight: 8 }}>
          <Text
            style={{
              color: "#FFFFFF",
              fontSize: 15,
              fontWeight: "700",
            }}
          >
            Purchase Reminders
          </Text>
          <Text
            style={{
              color: "#8E8E93",
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
          trackColor={{ false: "#262629", true: "#D4AF6A" }}
          thumbColor="#FFFFFF"
        />
      </View>

      {/* ── Subtle Divider ────────────────────────────────────────────── */}
      <View
        style={{
          height: 1,
          backgroundColor: "#1F1F23",
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
            backgroundColor: "rgba(212, 175, 106, 0.12)",
            borderWidth: 1,
            borderColor: "rgba(212, 175, 106, 0.25)",
            alignItems: "center",
            justifyContent: "center",
            marginRight: 12,
          }}
        >
          <Feather name="calendar" size={17} color="#D4AF6A" />
        </View>

        <View style={{ flex: 1, paddingRight: 8 }}>
          <Text
            style={{
              color: "#FFFFFF",
              fontSize: 15,
              fontWeight: "700",
            }}
          >
            Upcoming Bill Reminders
          </Text>
          <Text
            style={{
              color: "#8E8E93",
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
          trackColor={{ false: "#262629", true: "#D4AF6A" }}
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
          backgroundColor: "#1A1A1E",
          borderWidth: 1,
          borderColor: "#26262A",
        }}
      >
        <Feather
          name="settings"
          size={14}
          color="#D4AF6A"
          style={{ marginRight: 8 }}
        />
        <Text style={{ color: "#D4AF6A", fontWeight: "700", fontSize: 13 }}>
          Open Settings
        </Text>
      </TouchableOpacity>
    </View>
  );
}
