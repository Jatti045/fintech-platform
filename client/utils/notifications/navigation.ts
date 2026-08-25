// ─── Notification Navigation ───────────────────────────────────────────────
// Maps a tapped notification to the right place in the app. Keeping routing
// here (instead of in a screen) makes it reusable across cold starts,
// background delivery and in-app taps.

import * as Notifications from "expo-notifications";
import { router } from "expo-router";

import { logger } from "@/utils/logger";
import {
  PURCHASE_REMINDER_ROUTE,
  UPCOMING_BILL_ROUTE,
} from "@/constants/notifications";
import type { NotificationKind } from "@/types/notifications/types";

const SCOPE = "notifications.navigation";

/**
 * Routes the user based on a (tapped) notification:
 *   - purchaseReminder → Transactions tab (where a purchase is logged)
 *   - upcomingBill     → Home (where the Upcoming Bills card lives)
 */
export function handleNotificationResponse(
  response: Notifications.NotificationResponse,
): void {
  const kind = response.notification.request.content.data
    ?.kind as NotificationKind | undefined;

  if (kind === "purchaseReminder") {
    router.navigate(PURCHASE_REMINDER_ROUTE);
    return;
  }

  if (kind === "upcomingBill") {
    router.navigate(UPCOMING_BILL_ROUTE);
    return;
  }

  // Unknown kind — fall back to opening the app root rather than dropping the
  // user on a wrong screen.
  logger.debug(SCOPE, "Notification with no known route received", kind);
}

/**
 * Registers the notification-tap listener and handles a cold start that was
 * launched by tapping a notification. Returns an unsubscribe function.
 */
export function registerNotificationResponseHandler(): () => void {
  const subscription = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      try {
        handleNotificationResponse(response);
      } catch (error) {
        logger.warn(SCOPE, "Failed to handle notification response", error);
      }
    },
  );

  // App launched (cold start) directly from a notification tap.
  Notifications.getLastNotificationResponseAsync()
    .then((response) => {
      if (response) handleNotificationResponse(response);
    })
    .catch((error) =>
      logger.warn(SCOPE, "Failed to handle cold-start notification", error),
    );

  return () => subscription.remove();
}
