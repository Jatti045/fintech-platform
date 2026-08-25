/**
 * Notification preferences slice – reducer-level unit tests.
 */

import notificationReducer, {
  loadNotificationPreferences,
  setPurchaseRemindersEnabled,
  setNotificationTimezone,
  setNotificationPermissionStatus,
  resetNotificationPreferences,
} from "@/store/slices/notificationSlice";
import type { NotificationPreferencesState } from "@/types/notifications/types";

describe("notificationSlice", () => {
  const initialState: NotificationPreferencesState = {
    purchaseRemindersEnabled: true,
    billRemindersEnabled: true,
    timezone: null,
    permissionStatus: "undetermined",
    loaded: false,
  };

  it("starts with reminders enabled and unloaded", () => {
    expect(notificationReducer(undefined, { type: "@@INIT" })).toEqual(
      initialState,
    );
  });

  it("toggles purchase reminders off", () => {
    const state = notificationReducer(
      initialState,
      setPurchaseRemindersEnabled(false),
    );
    expect(state.purchaseRemindersEnabled).toBe(false);
  });

  it("re-enables purchase reminders", () => {
    const disabled = notificationReducer(
      initialState,
      setPurchaseRemindersEnabled(false),
    );
    const reEnabled = notificationReducer(
      disabled,
      setPurchaseRemindersEnabled(true),
    );
    expect(reEnabled.purchaseRemindersEnabled).toBe(true);
  });

  it("stores the current timezone", () => {
    const state = notificationReducer(
      initialState,
      setNotificationTimezone("Asia/Tokyo"),
    );
    expect(state.timezone).toBe("Asia/Tokyo");
  });

  it("stores the permission status", () => {
    const state = notificationReducer(
      initialState,
      setNotificationPermissionStatus("denied"),
    );
    expect(state.permissionStatus).toBe("denied");
  });

  it("hydrates persisted preferences and marks loaded", () => {
    const action = {
      type: loadNotificationPreferences.fulfilled.type,
      payload: { purchaseRemindersEnabled: false, timezone: "Europe/London" },
    };
    const state = notificationReducer(initialState, action);
    expect(state.purchaseRemindersEnabled).toBe(false);
    expect(state.timezone).toBe("Europe/London");
    expect(state.loaded).toBe(true);
  });

  it("falls back to defaults when nothing was stored", () => {
    const action = {
      type: loadNotificationPreferences.fulfilled.type,
      payload: null,
    };
    const state = notificationReducer(initialState, action);
    expect(state.purchaseRemindersEnabled).toBe(true);
    expect(state.timezone).toBe(null);
    expect(state.loaded).toBe(true);
  });

  it("marks loaded even when hydration failed", () => {
    const action = {
      type: loadNotificationPreferences.rejected.type,
      payload: "boom",
    };
    const state = notificationReducer(initialState, action);
    expect(state.loaded).toBe(true);
  });

  it("reset restores defaults without touching loaded", () => {
    const state = notificationReducer(
      {
        purchaseRemindersEnabled: false,
        billRemindersEnabled: false,
        timezone: "Asia/Tokyo",
        permissionStatus: "denied",
        loaded: true,
      },
      resetNotificationPreferences(),
    );
        expect(state).toEqual({
      purchaseRemindersEnabled: true,
      billRemindersEnabled: true,
      timezone: null,
      permissionStatus: "undetermined",
      loaded: true,
    });
  });
});
