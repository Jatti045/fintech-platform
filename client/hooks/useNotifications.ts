// ─── useNotifications ───────────────────────────────────────────────────────
// Orchestrates the whole notification lifecycle from a single place (the root
// layout). It owns:
//   • loading persisted preferences
//   • reacting to the authentication lifecycle (schedule after login, cancel
//     and reset on logout so a different user never inherits the last one)
//   • reacting to the enabled preference (schedule when on, cancel when off)
//   • permission handling (ask once, never nag after denial)
//   • timezone-change detection so the daily schedule is rebuilt when the
//     user travels
//   • re-syncing when the app returns to the foreground (covers permission
//     or timezone changes made in device settings)
//   • registering the notification-tap routing handler
//
// Screens should never schedule notifications directly — they talk to this
// hook / the preference slice instead.

import { useCallback, useEffect, useRef } from "react";
import { AppState } from "react-native";

import { useAppDispatch, useAppSelector, useAuth } from "@/hooks/useRedux";
import { logger } from "@/utils/logger";
import {
  loadNotificationPreferences,
  setNotificationTimezone,
  setNotificationPermissionStatus,
  resetNotificationPreferences,
  selectNotificationPreferencesLoaded,
  selectPurchaseRemindersEnabled,
  selectBillRemindersEnabled,
  selectNotificationTimezone,
} from "@/store/slices/notificationSlice";
import {
  ensureAndroidChannel,
  getPermissionStatus,
  requestPermission,
} from "@/utils/notifications/permissions";
import { getCurrentTimeZone, timezoneChanged } from "@/utils/notifications/timezone";
import {
  cancelPurchaseReminders,
  schedulePurchaseReminders,
  scheduleBillReminders,
  cancelBillReminders,
} from "@/utils/notifications/scheduler";
import { registerNotificationResponseHandler } from "@/utils/notifications/navigation";
import {
  isNotificationOnboardingPending,
  clearNotificationOnboardingFlag,
} from "@/utils/notifications/onboardingFlag";
import { useGetRecurringPaymentsQuery } from "@/store/api/apiSlice";

const SCOPE = "useNotifications";

/** Stable empty fallback — a fresh [] each render would retrigger effects. */
const NO_BILLS: never[] = [];

/** Local YYYY-MM-DD key so the recurring cache rolls over at midnight. */
function todayKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
}

export function useNotifications() {
  const dispatch = useAppDispatch();
  const { isAuthenticated, isLoading } = useAuth();
  const enabled = useAppSelector(selectPurchaseRemindersEnabled);
  const billsEnabled = useAppSelector(selectBillRemindersEnabled);
  const timezone = useAppSelector(selectNotificationTimezone);
  const prefsLoaded = useAppSelector(selectNotificationPreferencesLoaded);
  const wasAuthenticatedRef = useRef(false);

  // Subscribing here (not only on Home) keeps bill reminders in sync even
  // when Home has not mounted yet. RTK Query dedupes identical args, so this
  // shares the exact same cache entry / network request as the Home screen.
  const recurringQuery = useGetRecurringPaymentsQuery({ today: todayKey() });
  const detectedBills =
    recurringQuery.data?.recurringPayments ?? NO_BILLS;

  /**
   * Ensures the reminders are scheduled under the current conditions:
   * requests permission (only when undetermined), then schedules. The
   * scheduler is idempotent, so repeated calls never duplicate.
   *
   * While the account-creation onboarding prompt is pending, the permission
   * request is deferred: the onboarding flow is the user's first and only
   * in-app ask.
   */
  const syncReminders = useCallback(async () => {
    await ensureAndroidChannel();

    let permission = await getPermissionStatus();
    // Ask only when we haven't already (undetermined). A prior denial is
    // respected and we don't nag.
    if (
      permission === "undetermined" &&
      !(await isNotificationOnboardingPending())
    ) {
      permission = await requestPermission();
    }

    // Publish the resolved permission state so the UI (e.g. the preference
    // switch) can reflect whether notifications are actually permitted.
    dispatch(setNotificationPermissionStatus(permission));

    if (permission !== "granted") {
      logger.info(SCOPE, "Notifications not permitted; cancelling reminders");
      await cancelPurchaseReminders();
      await cancelBillReminders();
      return;
    }

    const currentTimezone = getCurrentTimeZone();
    if (timezoneChanged(timezone, currentTimezone)) {
      // The user's region changed (e.g. travel) — rebuilding the schedule for
      // the new local time so the 12:00/18:00 reminders stay correct.
      logger.info(SCOPE, "Timezone changed; rebuilding schedule", {
        from: timezone,
        to: currentTimezone,
      });
    }

    // Each reminder type is gated by its own preference. Both schedulers are
    // idempotent (prune-then-create), so calling either branch is always safe.
    if (enabled) {
      await schedulePurchaseReminders();
    } else {
      await cancelPurchaseReminders();
    }

    // Bill reminders: HIGH-confidence predictions only, capped and dated.
    if (billsEnabled && detectedBills.length > 0) {
      await scheduleBillReminders(
        detectedBills
          .filter((bill) => bill.confidence === "HIGH")
          .map((bill) => ({
            seriesKey: bill.seriesKey,
            name: bill.name,
            expectedAmount: bill.expectedAmount,
            nextExpectedDate: bill.nextExpectedDate,
          })),
      );
    } else {
      await cancelBillReminders();
    }

    if (timezoneChanged(timezone, currentTimezone)) {
      dispatch(setNotificationTimezone(currentTimezone));
    }
  }, [dispatch, timezone, enabled, billsEnabled, detectedBills]);

  // Load preferences once and register the tap-routing handler.
  useEffect(() => {
    dispatch(loadNotificationPreferences());
    return registerNotificationResponseHandler();
  }, [dispatch]);

  // React to the auth + preference lifecycle.
  useEffect(() => {
    if (isLoading) return;

    const wasAuthenticated = wasAuthenticatedRef.current;
    wasAuthenticatedRef.current = isAuthenticated;

    if (!isAuthenticated) {
      // Logged out: cancel reminders and reset preferences so the next user on
      // this device starts from a clean slate.
      if (wasAuthenticated) {
        dispatch(resetNotificationPreferences());
        // The onboarding flag is account-scoped: clear it so another user on
        // this device is not offered a stale prompt.
        void clearNotificationOnboardingFlag().catch((error) =>
          logger.warn(SCOPE, "Failed to clear onboarding flag on logout", error),
        );
      }
      void cancelPurchaseReminders().catch((error) =>
        logger.warn(SCOPE, "Failed to cancel reminders on logout", error),
      );
      void cancelBillReminders().catch((error) =>
        logger.warn(SCOPE, "Failed to cancel bill reminders on logout", error),
      );
      return;
    }

    // Wait for persisted preferences before deciding anything.
    if (!prefsLoaded) return;

    // syncReminders applies each preference independently (scheduling enabled
    // types, cancelling disabled ones), so one call covers every combination.
    void syncReminders().catch((error) =>
      logger.warn(SCOPE, "Failed to sync reminders", error),
    );
  }, [
    dispatch,
    isLoading,
    isAuthenticated,
    enabled,
    billsEnabled,
    prefsLoaded,
    syncReminders,
  ]);

  // Re-sync when the app returns to the foreground. This catches permission
  // grants/revocations, timezone changes and refreshed bill predictions made
  // while the app was closed.
  useEffect(() => {
    if (isLoading || !isAuthenticated || !prefsLoaded) return;

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void syncReminders().catch((error) =>
          logger.warn(SCOPE, "Failed to sync reminders on foreground", error),
        );
      }
    });

    return () => subscription.remove();
  }, [isLoading, isAuthenticated, prefsLoaded, enabled, syncReminders]);
}
