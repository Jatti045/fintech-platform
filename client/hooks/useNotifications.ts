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
} from "@/utils/notifications/scheduler";
import { registerNotificationResponseHandler } from "@/utils/notifications/navigation";

const SCOPE = "useNotifications";

export function useNotifications() {
  const dispatch = useAppDispatch();
  const { isAuthenticated, isLoading } = useAuth();
  const enabled = useAppSelector(selectPurchaseRemindersEnabled);
  const timezone = useAppSelector(selectNotificationTimezone);
  const prefsLoaded = useAppSelector(selectNotificationPreferencesLoaded);
  const wasAuthenticatedRef = useRef(false);

  /**
   * Ensures the reminders are scheduled under the current conditions:
   * requests permission (only when undetermined), then schedules. The
   * scheduler is idempotent, so repeated calls never duplicate.
   */
  const syncReminders = useCallback(async () => {
    await ensureAndroidChannel();

    let permission = await getPermissionStatus();
    // Ask only when we haven't already (undetermined). A prior denial is
    // respected and we don't nag.
    if (permission === "undetermined") {
      permission = await requestPermission();
    }

    // Publish the resolved permission state so the UI (e.g. the preference
    // switch) can reflect whether notifications are actually permitted.
    dispatch(setNotificationPermissionStatus(permission));

    if (permission !== "granted") {
      logger.info(SCOPE, "Notifications not permitted; cancelling reminders");
      await cancelPurchaseReminders();
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

    // Idempotent: prunes owned instances then recreates the configured set.
    await schedulePurchaseReminders();

    if (timezoneChanged(timezone, currentTimezone)) {
      dispatch(setNotificationTimezone(currentTimezone));
    }
  }, [dispatch, timezone]);

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
      }
      void cancelPurchaseReminders().catch((error) =>
        logger.warn(SCOPE, "Failed to cancel reminders on logout", error),
      );
      return;
    }

    // Wait for persisted preferences before deciding anything.
    if (!prefsLoaded) return;

    if (!enabled) {
      void cancelPurchaseReminders().catch((error) =>
        logger.warn(SCOPE, "Failed to cancel reminders (disabled)", error),
      );
      return;
    }

    void syncReminders().catch((error) =>
      logger.warn(SCOPE, "Failed to sync reminders", error),
    );
  }, [
    dispatch,
    isLoading,
    isAuthenticated,
    enabled,
    prefsLoaded,
    syncReminders,
  ]);

  // Re-sync when the app returns to the foreground. This catches permission
  // grants/revocations and timezone changes made while the app was closed.
  useEffect(() => {
    if (isLoading || !isAuthenticated || !prefsLoaded || !enabled) return;

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
