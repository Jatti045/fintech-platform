// ─── Notification Onboarding Flag ───────────────────────────────────────────
// Small AsyncStorage-backed flag used to defer the automatic permission
// request until the one-time onboarding prompt has been shown after account
// creation. Kept dependency-free so both the notification lifecycle hook and
// the onboarding prompt can share it without pulling in navigation modules.

import AsyncStorage from "@react-native-async-storage/async-storage";

import { logger } from "@/utils/logger";
import { NOTIFICATION_ONBOARDING_STORAGE_KEY } from "@/constants/notifications";

const SCOPE = "notifications.onboardingFlag";

/** True while the one-time onboarding notification prompt is still pending. */
export async function isNotificationOnboardingPending(): Promise<boolean> {
  try {
    return (
      (await AsyncStorage.getItem(NOTIFICATION_ONBOARDING_STORAGE_KEY)) === "1"
    );
  } catch (error) {
    logger.warn(SCOPE, "Failed to read onboarding flag", error);
    return false;
  }
}

/** Clears the one-time onboarding flag so the prompt is never shown again. */
export async function clearNotificationOnboardingFlag(): Promise<void> {
  try {
    await AsyncStorage.removeItem(NOTIFICATION_ONBOARDING_STORAGE_KEY);
  } catch (error) {
    logger.warn(SCOPE, "Failed to clear onboarding flag", error);
  }
}
