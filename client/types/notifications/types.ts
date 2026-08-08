// ─── Notification Domain Types ─────────────────────────────────────────────
// Central shapes shared across the notification feature. Adding a new
// notification type later only requires extending `NotificationKind` and
// registering a schedule in `constants/notifications.ts`.

/**
 * The distinct kinds of notifications the app can produce today.
 * Extend this union (and add a schedule in `constants/notifications.ts`)
 * to support new notification types such as budget alerts or monthly
 * summaries.
 */
export type NotificationKind = "purchaseReminder";

/**
 * The part of the day a reminder belongs to. Used to pick message copy and
 * to distinguish otherwise-identical schedules.
 */
export type ReminderTimeSlot = "midday" | "evening";

/**
 * A single repeating daily schedule. `hour`/`minute` are interpreted in the
 * device's local time zone by the OS, so DST transitions are handled for us.
 */
export interface NotificationSchedule {
  /** Stable, unique identifier used to cancel/replace this schedule safely. */
  identifier: string;
  kind: NotificationKind;
  timeSlot: ReminderTimeSlot;
  hour: number;
  minute: number;
}

/** Normalised notification permission state used across the feature. */
export type NotificationPermissionState = "granted" | "denied" | "undetermined";

/** Persisted, device-level notification preferences. */
export interface NotificationPreferencesState {
  /** Master switch for purchase reminders. */
  purchaseRemindersEnabled: boolean;
  /**
   * IANA timezone (e.g. "America/Toronto") the schedule was last built for.
   * Used to detect travel/timezone changes so the schedule can be rebuilt.
   */
  timezone: string | null;
  /**
   * Last-known notification permission state (device-level, not persisted).
   * Drives UI, e.g. disabling the preference switch when permission is denied.
   */
  permissionStatus: NotificationPermissionState;
  /** True once preferences have been hydrated from storage. */
  loaded: boolean;
}

/** Structured content for a single notification. */
export interface NotificationContent {
  title: string;
  body: string;
  /** Payload carried on the notification; used for tap routing. */
  data: { kind: NotificationKind };
}
