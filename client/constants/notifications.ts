// ─── Notification Configuration ─────────────────────────────────────────────
// This is the single source of truth for what notifications exist and when
// they fire. To add a new notification type, add an entry to
// NOTIFICATION_SCHEDULES and extend getNotificationContent() in
// utils/notifications/content.ts — nothing else needs to change.

import type { NotificationSchedule } from "@/types/notifications/types";

/** AsyncStorage key under which notification preferences are persisted. */
export const NOTIFICATION_PREFERENCES_STORAGE_KEY = "notificationPreferences";

/**
 * AsyncStorage flag set after account creation and cleared once the one-time
 * onboarding notification prompt has been shown. While set, the automatic
 * permission request is deferred so the onboarding prompt is the user's first
 * and only in-app ask.
 */
export const NOTIFICATION_ONBOARDING_STORAGE_KEY = "notificationOnboardingPending";

/** Android notification channel used for purchase reminders. */
export const ANDROID_NOTIFICATION_CHANNEL_ID = "purchase-reminders";
export const ANDROID_NOTIFICATION_CHANNEL_NAME = "Purchase reminders";

/** Route opened when a purchase-reminder notification is tapped. */
export const PURCHASE_REMINDER_ROUTE = "/(tabs)/transaction";

/** Route opened when an upcoming-bill notification is tapped. */
export const UPCOMING_BILL_ROUTE = "/(tabs)";

/**
 * Identifier prefix owned by the upcoming-bill scheduler. Bill reminders are
 * dated (not repeating), so they are pruned by prefix before every resync
 * instead of living in NOTIFICATION_SCHEDULES.
 */
export const BILL_REMINDER_IDENTIFIER_PREFIX = "bill-reminder-";

/**
 * Hard cap on scheduled bill reminders at any moment. High-confidence bills
 * only, so this bound plus the prefix-pruning makes spam structurally
 * impossible.
 */
export const MAX_BILL_REMINDERS = 5;

/**
 * A bill is reminder-worthy when its predicted date falls within this many
 * days. Conservative: short horizon keeps the prediction honest.
 */
export const BILL_REMINDER_HORIZON_DAYS = 3;

/**
 * The app's repeating daily schedules. `hour`/`minute` are expressed in the
 * user's local time — the OS resolves them against the device's current
 * time zone (and follows DST changes automatically).
 *
 * Two reminders per day:
 *   - 12:00 local — a midday check-in
 *   - 18:00 local — an end-of-day check-in
 */
export const NOTIFICATION_SCHEDULES: readonly NotificationSchedule[] = [
  {
    identifier: "purchase-reminder-midday",
    kind: "purchaseReminder",
    timeSlot: "midday",
    hour: 12,
    minute: 0,
  },
  {
    identifier: "purchase-reminder-evening",
    kind: "purchaseReminder",
    timeSlot: "evening",
    hour: 18,
    minute: 0,
  },
];

/**
 * Set of identifiers owned by this app. Used to prune any stale/duplicate
 * instances before (re)scheduling so we never accumulate duplicates.
 */
export const OWNED_NOTIFICATION_IDENTIFIERS: ReadonlySet<string> = new Set(
  NOTIFICATION_SCHEDULES.map((schedule) => schedule.identifier),
);
