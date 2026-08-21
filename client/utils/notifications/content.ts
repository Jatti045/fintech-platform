// ─── Notification Content ───────────────────────────────────────────────────
// Central definition of notification copy. Keeps message strings out of the
// scheduling logic so both are easy to change independently. Extend the map
// here when new notification kinds are added.
//
// Messages are written to feel like a helpful budgeting assistant rather than
// a system alert: short, friendly, non-judgmental and free of dashes and
// emoji. Each time slot has several variants that rotate daily so the user
// does not receive exactly the same message every day.

import type {
  NotificationContent,
  NotificationKind,
  ReminderTimeSlot,
} from "@/types/notifications/types";

interface SlotCopy {
  title: string;
  body: string;
}

const PURCHASE_REMINDER_VARIANTS: Record<ReminderTimeSlot, SlotCopy[]> = {
  midday: [
    {
      title: "Quick check in",
      body: "Hey! Take a moment to log any purchases from today.",
    },
    {
      title: "Midday check in",
      body: "Made any purchases so far today? Log them to keep your budget accurate.",
    },
    {
      title: "A friendly nudge",
      body: "Anything you bought today? A quick log helps your budget stay on track.",
    },
  ],
  evening: [
    {
      title: "Evening check in",
      body: "Before the day winds down, log any purchases you made today.",
    },
    {
      title: "Wrap up your day",
      body: "Did you buy anything today? Log it whenever you get a moment.",
    },
    {
      title: "End of day nudge",
      body: "Any purchases from today to log? It only takes a few seconds.",
    },
  ],
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Number of days since the Unix epoch (UTC). Used to rotate copy daily. */
function utcDayIndex(): number {
  return Math.floor(Date.now() / MS_PER_DAY);
}

/**
 * Returns the structured content (title, body and routing payload) for a
 * notification of the given kind and time slot.
 *
 * When several variants exist for a slot, the copy rotates daily (deterministic
 * for a given {@code dayIndex}) so the user does not get the same message
 * every day. {@code dayIndex} defaults to today and is exposed for tests.
 *
 * Throws if an unhandled kind is passed, which surfaces configuration errors
 * early instead of silently delivering the wrong message.
 */
export function getNotificationContent(
  kind: NotificationKind,
  timeSlot: ReminderTimeSlot,
  dayIndex: number = utcDayIndex(),
): NotificationContent {
  switch (kind) {
    case "purchaseReminder": {
      const variants = PURCHASE_REMINDER_VARIANTS[timeSlot];
      const variant = variants[dayIndex % variants.length];
      return {
        ...variant,
        data: { kind },
      };
    }
    default: {
      // Exhaustive guard — a future kind must be handled here.
      const exhaustive: never = kind;
      throw new Error(`getNotificationContent: unhandled kind "${exhaustive}"`);
    }
  }
}
