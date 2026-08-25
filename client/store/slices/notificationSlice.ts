import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";

import { logger } from "@/utils/logger";
import { NOTIFICATION_PREFERENCES_STORAGE_KEY } from "@/constants/notifications";
import type {
  NotificationPermissionState,
  NotificationPreferencesState,
} from "@/types/notifications/types";

export type { NotificationPreferencesState };

const initialState: NotificationPreferencesState = {
  purchaseRemindersEnabled: true,
  billRemindersEnabled: true,
  timezone: null,
  permissionStatus: "undetermined",
  loaded: false,
};

/**
 * Hydrates persisted notification preferences. The `loaded` flag is set in
 * both the fulfilled and rejected handlers so the UI/hook can rely on it to
 * know that a decision has been made.
 */
export const loadNotificationPreferences = createAsyncThunk(
  "notifications/loadPreferences",
  async (_, { rejectWithValue }) => {
    try {
      const raw = await AsyncStorage.getItem(NOTIFICATION_PREFERENCES_STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as Partial<NotificationPreferencesState>;
    } catch (error) {
      logger.warn("notificationSlice", "Failed to load preferences", error);
      return rejectWithValue("Failed to load notification preferences");
    }
  },
);

/**
 * Persists notification preferences. Kept separate from the reducer so the
 * reducer stays pure (matching the existing theme/profile convention where
 * persistence happens at the call site).
 */
export async function persistNotificationPreferences(
  preferences: Pick<
    NotificationPreferencesState,
    "purchaseRemindersEnabled" | "billRemindersEnabled" | "timezone"
  >,
): Promise<void> {
  try {
    await AsyncStorage.setItem(
      NOTIFICATION_PREFERENCES_STORAGE_KEY,
      JSON.stringify(preferences),
    );
  } catch (error) {
    logger.warn("notificationSlice", "Failed to persist preferences", error);
  }
}

const notificationSlice = createSlice({
  name: "notifications",
  initialState,
  reducers: {
    setPurchaseRemindersEnabled(state, action: PayloadAction<boolean>) {
      state.purchaseRemindersEnabled = action.payload;
    },
    setBillRemindersEnabled(state, action: PayloadAction<boolean>) {
      state.billRemindersEnabled = action.payload;
    },
    setNotificationTimezone(state, action: PayloadAction<string | null>) {
      state.timezone = action.payload;
    },
    setNotificationPermissionStatus(
      state,
      action: PayloadAction<NotificationPermissionState>,
    ) {
      state.permissionStatus = action.payload;
    },
    resetNotificationPreferences(state) {
      state.purchaseRemindersEnabled = initialState.purchaseRemindersEnabled;
      state.billRemindersEnabled = initialState.billRemindersEnabled;
      state.timezone = initialState.timezone;
      state.permissionStatus = initialState.permissionStatus;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadNotificationPreferences.fulfilled, (state, action) => {
        const preferences = action.payload;
        state.purchaseRemindersEnabled =
          preferences?.purchaseRemindersEnabled ??
          initialState.purchaseRemindersEnabled;
        state.billRemindersEnabled =
          preferences?.billRemindersEnabled ?? initialState.billRemindersEnabled;
        state.timezone = preferences?.timezone ?? initialState.timezone;
        state.loaded = true;
      })
      .addCase(loadNotificationPreferences.rejected, (state) => {
        state.loaded = true;
      });
  },
});

export const {
  setPurchaseRemindersEnabled,
  setBillRemindersEnabled,
  setNotificationTimezone,
  setNotificationPermissionStatus,
  resetNotificationPreferences,
} = notificationSlice.actions;

export default notificationSlice.reducer;

// ── Selectors ──────────────────────────────────────────────────────────────
export const selectPurchaseRemindersEnabled = (state: {
  notifications: NotificationPreferencesState;
}) => state.notifications.purchaseRemindersEnabled;

export const selectBillRemindersEnabled = (state: {
  notifications: NotificationPreferencesState;
}) => state.notifications.billRemindersEnabled;

export const selectNotificationTimezone = (state: {
  notifications: NotificationPreferencesState;
}) => state.notifications.timezone;

export const selectNotificationPermissionStatus = (state: {
  notifications: NotificationPreferencesState;
}) => state.notifications.permissionStatus;

export const selectNotificationPreferencesLoaded = (state: {
  notifications: NotificationPreferencesState;
}) => state.notifications.loaded;
