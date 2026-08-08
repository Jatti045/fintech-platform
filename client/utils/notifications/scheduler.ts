// ─── Notification Scheduler ────────────────────────────────────────────────
// Owns the (re)creation and cancellation of the app's repeating local
// notifications. Scheduling is strictly idempotent: every call prunes any
// existing instance of our identifiers before re-creating exactly the set in
// NOTIFICATION_SCHEDULES, so repeated initialisation can never accumulate
// duplicates.

import * as Notifications from "expo-notifications";

import { logger } from "@/utils/logger";
import { getNotificationContent } from "@/utils/notifications/content";
import {
  NOTIFICATION_SCHEDULES,
  OWNED_NOTIFICATION_IDENTIFIERS,
  ANDROID_NOTIFICATION_CHANNEL_ID,
} from "@/constants/notifications";

const SCOPE = "notifications.scheduler";

/** Cancels every scheduled notification that we own. Failures are logged. */
async function cancelOwnedNotifications(): Promise<void> {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const owned = scheduled.filter((notification) =>
      OWNED_NOTIFICATION_IDENTIFIERS.has(notification.identifier),
    );

    if (owned.length > 0) {
      await Promise.all(
        owned.map((notification) =>
          Notifications.cancelScheduledNotificationAsync(notification.identifier),
        ),
      );
      logger.info(
        SCOPE,
        `Cancelled ${owned.length} stale scheduled notification(s)`,
      );
    }
  } catch (error) {
    logger.warn(SCOPE, "Failed to cancel stale notifications", error);
  }
}

/**
 * (Re)creates the purchase-reminder schedule. Safe to call any number of
 * times — existing owned notifications are removed first, so the result is
 * always exactly the configured set, never a growing list.
 *
 * Daily triggers are interpreted in device-local time by the OS, so delivery
 * follows the current time zone and DST automatically.
 */
export async function schedulePurchaseReminders(): Promise<void> {
  try {
    await cancelOwnedNotifications();

    for (const schedule of NOTIFICATION_SCHEDULES) {
      const content = getNotificationContent(schedule.kind, schedule.timeSlot);
      await Notifications.scheduleNotificationAsync({
        identifier: schedule.identifier,
        content,
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: schedule.hour,
          minute: schedule.minute,
          channelId: ANDROID_NOTIFICATION_CHANNEL_ID,
        },
      });
    }

    logger.info(
      SCOPE,
      `Scheduled ${NOTIFICATION_SCHEDULES.length} purchase reminder(s)`,
    );
  } catch (error) {
    logger.error(SCOPE, "Failed to schedule purchase reminders", error);
    throw error;
  }
}

/** Removes every owned scheduled notification (used on logout/disable). */
export async function cancelPurchaseReminders(): Promise<void> {
  await cancelOwnedNotifications();
  logger.info(SCOPE, "Purchase reminders cancelled");
}
