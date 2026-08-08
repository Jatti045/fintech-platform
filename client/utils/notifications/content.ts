// ─── Notification Content ───────────────────────────────────────────────────
// Central definition of notification copy. Keeps message strings out of the
// scheduling logic so both are easy to change independently. Extend the map
// here when new notification kinds are added.

import type {
  NotificationContent,
  NotificationKind,
  ReminderTimeSlot,
} from "@/types/notifications/types";

interface SlotCopy {
  title: string;
  body: string;
}

const PURCHASE_REMINDER_COPY: Record<ReminderTimeSlot, SlotCopy> = {
  midday: {
    title: "Midday check-in",
    body: "Take a minute to log anything you've bought this morning so your budget stays accurate.",
  },
  evening: {
    title: "Evening check-in",
    body: "Quick reminder to log today's purchases — keeping your budget up to date only takes a moment.",
  },
};

/**
 * Returns the structured content (title, body and routing payload) for a
 * notification of the given kind and time slot.
 *
 * Throws if an unhandled kind is passed, which surfaces configuration errors
 * early instead of silently delivering the wrong message.
 */
export function getNotificationContent(
  kind: NotificationKind,
  timeSlot: ReminderTimeSlot,
): NotificationContent {
  switch (kind) {
    case "purchaseReminder":
      return {
        ...PURCHASE_REMINDER_COPY[timeSlot],
        data: { kind },
      };
    default: {
      // Exhaustive guard — a future kind must be handled here.
      const exhaustive: never = kind;
      throw new Error(`getNotificationContent: unhandled kind "${exhaustive}"`);
    }
  }
}
