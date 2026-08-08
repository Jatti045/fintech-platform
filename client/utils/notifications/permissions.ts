// ─── Notification Permissions ──────────────────────────────────────────────
// Thin wrapper around the native notification-permission APIs. Centralises
// permission reads/requests and Android channel setup so scheduling code never
// talks to the native module directly. Failures are caught and logged rather
// than allowed to crash the app.

import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { logger } from "@/utils/logger";
import {
  ANDROID_NOTIFICATION_CHANNEL_ID,
  ANDROID_NOTIFICATION_CHANNEL_NAME,
} from "@/constants/notifications";
import type { NotificationPermissionState } from "@/types/notifications/types";

const SCOPE = "notifications.permissions";

/**
 * Creates/refreshes the Android notification channel the reminders use.
 * No-op on non-Android platforms. Failures are logged and swallowed because a
 * missing channel should not crash the app — the OS falls back to defaults.
 */
export async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  try {
    await Notifications.setNotificationChannelAsync(
      ANDROID_NOTIFICATION_CHANNEL_ID,
      {
        name: ANDROID_NOTIFICATION_CHANNEL_NAME,
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#4F46E5",
      },
    );
  } catch (error) {
    logger.warn(SCOPE, "Failed to configure Android notification channel", error);
  }
}

/** Reads the current permission state without prompting the user. */
export async function getPermissionStatus(): Promise<NotificationPermissionState> {
  try {
    const settings = await Notifications.getPermissionsAsync();
    if (settings.granted) return "granted";
    // `undetermined` is the only state we can still ask about, so anything else
    // is treated as a definitive denial (don't re-prompt).
    return settings.status === "undetermined" ? "undetermined" : "denied";
  } catch (error) {
    logger.warn(SCOPE, "Failed to read notification permission status", error);
    return "undetermined";
  }
}

/**
 * Prompts the user for notification permission and returns the resulting
 * state. Safe to call only when the state is "undetermined"; calling it after
 * a denial is a no-op on both platforms.
 */
export async function requestPermission(): Promise<NotificationPermissionState> {
  try {
    const settings = await Notifications.requestPermissionsAsync();
    if (settings.granted) return "granted";
    return settings.status === "undetermined" ? "undetermined" : "denied";
  } catch (error) {
    logger.warn(SCOPE, "Failed to request notification permission", error);
    return "undetermined";
  }
}
