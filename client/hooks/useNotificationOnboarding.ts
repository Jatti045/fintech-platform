// ─── Notification Onboarding ────────────────────────────────────────────────
// One-time, optional notification prompt shown after account creation. The
// user can enable notifications or decline; either way the flag is cleared so
// the prompt is never shown again. Declining is respected: the preference is
// left off so nothing re-asks, and the user is pointed to Profile settings.

import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { useAppDispatch, useAuth } from "@/hooks/useRedux";
import { useThemedAlert } from "@/utils/themedAlert";
import { logger } from "@/utils/logger";
import {
  setPurchaseRemindersEnabled,
  setNotificationPermissionStatus,
  persistNotificationPreferences,
} from "@/store/slices/notificationSlice";
import { requestPermission } from "@/utils/notifications/permissions";
import {
  cancelPurchaseReminders,
  schedulePurchaseReminders,
} from "@/utils/notifications/scheduler";
import { clearNotificationOnboardingFlag } from "@/utils/notifications/onboardingFlag";
import { NOTIFICATION_ONBOARDING_STORAGE_KEY } from "@/constants/notifications";

const SCOPE = "notifications.onboarding";

export function useNotificationOnboarding() {
  const dispatch = useAppDispatch();
  const { isAuthenticated } = useAuth();
  const { showAlert } = useThemedAlert();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;

    (async () => {
      try {
        const pending =
          (await AsyncStorage.getItem(NOTIFICATION_ONBOARDING_STORAGE_KEY)) === "1";
        if (!cancelled && pending) setVisible(true);
      } catch (error) {
        logger.warn(SCOPE, "Failed to read onboarding flag", error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  const finish = useCallback(async (granted: boolean) => {
    // Preference reflects what the OS actually allows so we never claim
    // notifications are enabled when permission was denied.
    dispatch(setPurchaseRemindersEnabled(granted));
    await persistNotificationPreferences({
      purchaseRemindersEnabled: granted,
      timezone: null,
    });
    await clearNotificationOnboardingFlag();
    setVisible(false);

    if (granted) {
      await schedulePurchaseReminders();
    } else {
      await cancelPurchaseReminders();
      showAlert({
        title: "No problem",
        message:
          "You can enable notifications anytime from your profile settings.",
      });
    }
  }, [dispatch, showAlert]);

  /** The user accepted: request OS permission and act on the result. */
  const handleEnable = useCallback(async () => {
    const permission = await requestPermission();
    dispatch(setNotificationPermissionStatus(permission));
    await finish(permission === "granted");
  }, [dispatch, finish]);

  /** The user declined: leave notifications off and never ask again. */
  const handleDecline = useCallback(async () => {
    await finish(false);
  }, [finish]);

  return { visible, handleEnable, handleDecline };
}
