import * as SecureStore from "expo-secure-store";
import { AUTH_TOKEN_STORAGE_KEY } from "@/constants/storageKeys";
import { logger } from "@/utils/logger";

const SCOPE = "secureStorage";

export async function setAuthToken(token: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(AUTH_TOKEN_STORAGE_KEY, token, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  } catch (error) {
    logger.error(
      SCOPE,
      "Failed to persist auth token in secure storage",
    );
    throw error;
  }
}

export async function getAuthToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(AUTH_TOKEN_STORAGE_KEY);
  } catch (error) {
    logger.warn(SCOPE, "Failed to read auth token from secure storage");
    return null;
  }
}

export async function clearAuthToken(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(AUTH_TOKEN_STORAGE_KEY);
  } catch (error) {
    logger.warn(SCOPE, "Failed to clear auth token from secure storage");
  }
}
