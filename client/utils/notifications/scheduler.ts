// ─── Notification Scheduler ────────────────────────────────────────────────
// Owns the (re)creation and cancellation of the app's repeating local
// notifications. Scheduling is strictly idempotent: every call prunes any
// existing instance of our identifiers before re-creating exactly the set in
// NOTIFICATION_SCHEDULES, so repeated initialisation can never accumulate
// duplicates.

import * as Notifications from "expo-notifications";

import { logger } from "@/utils/logger";
import {
  getNotificationContent,
  getUpcomingBillContent,
} from "@/utils/notifications/content";
import {
  NOTIFICATION_SCHEDULES,
  OWNED_NOTIFICATION_IDENTIFIERS,
  ANDROID_NOTIFICATION_CHANNEL_ID,
  BILL_REMINDER_IDENTIFIER_PREFIX,
  MAX_BILL_REMINDERS,
  BILL_REMINDER_HORIZON_DAYS,
} from "@/constants/notifications";

const SCOPE = "notifications.scheduler";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

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

// ── Upcoming-bill reminders ────────────────────────────────────────────────

/** Minimal bill shape the scheduler needs (from the recurring-payments API). */
export interface BillReminderInput {
  seriesKey: string;
  name: string;
  expectedAmount: number;
  nextExpectedDate: string;
}

/**
 * Cancels every scheduled bill reminder (identified by our prefix). Prefix
 * pruning — not a fixed identifier set — because bill reminders are dated,
 * per-series, and change as predictions refresh. Failures are swallowed so
 * callers never need try/catch.
 */
async function cancelBillRemindersByPrefix(): Promise<void> {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const owned = scheduled.filter((notification) =>
      notification.identifier.startsWith(BILL_REMINDER_IDENTIFIER_PREFIX),
    );
    if (owned.length > 0) {
      await Promise.all(
        owned.map((notification) =>
          Notifications.cancelScheduledNotificationAsync(notification.identifier),
        ),
      );
      logger.info(SCOPE, `Cancelled ${owned.length} stale bill reminder(s)`);
    }
  } catch (error) {
    logger.warn(SCOPE, "Failed to cancel stale bill reminders", error);
  }
}

/**
 * Rebuilds upcoming-bill reminders for exactly the given bills:
 *   - HIGH confidence only (MEDIUM/unknown never notify),
 *   - predicted within BILL_REMINDER_HORIZON_DAYS of now,
 *   - at most MAX_BILL_REMINDERS, soonest first,
 *   - one reminder per series (identifier derived from the stable series key).
 *
 * Idempotent by construction: every call prunes all prefix-owned
 * notifications before creating exactly the current set, so repeated syncs
 * (foreground, data refresh) can never accumulate duplicates.
 *
 * The trigger fires on the day BEFORE the predicted date at 18:00 device-local
 * time ("usually renews tomorrow"), resolved against the OS time zone.
 */
export async function scheduleBillReminders(bills: BillReminderInput[]): Promise<void> {
  await cancelBillRemindersByPrefix();

  const now = Date.now();
  const horizonMs = BILL_REMINDER_HORIZON_DAYS * MS_PER_DAY;
  const reminderWorthy = bills
    .filter((bill) => {
      if (!bill.nextExpectedDate) return false;
      const due = new Date(bill.nextExpectedDate).getTime();
      return Number.isFinite(due) && due > now && due - now <= horizonMs;
    })
    .sort(
      (a, b) =>
        new Date(a.nextExpectedDate).getTime() -
        new Date(b.nextExpectedDate).getTime(),
    )
    .slice(0, MAX_BILL_REMINDERS);

  for (const bill of reminderWorthy) {
    const dueDate = new Date(bill.nextExpectedDate);
    // Fire the evening before the predicted renewal day.
    const fireDay = new Date(dueDate.getTime() - MS_PER_DAY);

    const whenText =
      Math.round((dueDate.getTime() - now) / MS_PER_DAY) <= 1
        ? "around tomorrow"
        : `around ${fireDay.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
    const amountText = `$${bill.expectedAmount.toFixed(2)}`;

    await Notifications.scheduleNotificationAsync({
      identifier: `${BILL_REMINDER_IDENTIFIER_PREFIX}${encodeURIComponent(bill.seriesKey)}`,
      content: getUpcomingBillContent(bill.name, amountText, whenText),
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
        year: fireDay.getFullYear(),
        month: fireDay.getMonth() + 1,
        day: fireDay.getDate(),
        hour: 18,
        minute: 0,
        channelId: ANDROID_NOTIFICATION_CHANNEL_ID,
      },
    });
  }

  logger.info(SCOPE, `Scheduled ${reminderWorthy.length} bill reminder(s)`);
}

/** Cancels every scheduled bill reminder without rescheduling. */
export async function cancelBillReminders(): Promise<void> {
  await cancelBillRemindersByPrefix();
  logger.info(SCOPE, "Bill reminders cancelled");
}
