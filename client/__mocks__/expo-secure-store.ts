/**
 * Manual mock for expo-secure-store used by Jest.
 * Stubs the async secure-storage API so API-layer unit tests (which import
 * utils/secureStorage → expo-secure-store) can run in the Node test env.
 */

/// <reference types="jest" />

export const WHEN_UNLOCKED_THIS_DEVICE_ONLY = "whenUnlockedThisDeviceOnly";
export const AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY =
  "afterFirstUnlockThisDeviceOnly";
export const WHEN_UNLOCKED = "whenUnlocked";
export const AFTER_FIRST_UNLOCK = "afterFirstUnlock";
export const ALWAYS = "always";
export const ALWAYS_THIS_DEVICE_ONLY = "alwaysThisDeviceOnly";
export const WHEN_PASSCODE_SET_THIS_DEVICE_ONLY =
  "whenPasscodeSetThisDeviceOnly";
export const WHEN_UNLOCKED_THIS_DEVICE_ONLY_USE_DATA_PROTECTION_WHEN_AVAILABLE =
  "whenUnlockedThisDeviceOnlyUseDataProtectionWhenAvailable";

export const setItemAsync = jest.fn().mockResolvedValue(undefined);
export const getItemAsync = jest.fn().mockResolvedValue(null);
export const deleteItemAsync = jest.fn().mockResolvedValue(undefined);

export function __resetSecureStore() {
  setItemAsync.mockClear();
  getItemAsync.mockClear();
  deleteItemAsync.mockClear();
  getItemAsync.mockResolvedValue(null);
}
