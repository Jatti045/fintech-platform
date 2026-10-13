import * as SecureStore from "expo-secure-store";
import { AUTH_TOKEN_STORAGE_KEY } from "@/constants/storageKeys";
import { logger } from "@/utils/logger";

import { withDeadline, STORAGE_TIMEOUT_MS } from "./withDeadline";

const SCOPE = "secureStorage";

export async function setAuthToken(token: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(AUTH_TOKEN_STORAGE_KEY, token, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  } catch (error) {
    logger.error(SCOPE, "Failed to persist auth token in secure storage");
    throw error;
  }
}

export async function getAuthToken(): Promise<string | null> {
  try {
    return await withDeadline(
      SecureStore.getItemAsync(AUTH_TOKEN_STORAGE_KEY),
      "Secure storage is temporarily unavailable. Please retry.",
      STORAGE_TIMEOUT_MS,
    );
  } catch (error) {
    logger.warn(SCOPE, "Failed to read auth token from secure storage");
    throw error;
  }
}

export async function clearAuthToken(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(AUTH_TOKEN_STORAGE_KEY);
  } catch (error) {
    logger.warn(SCOPE, "Failed to clear auth token from secure storage");
  }
}
