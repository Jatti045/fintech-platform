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

export const storage = new Map<string, string>();
export const setItemAsync = jest.fn(async (key: string, value: string) => { storage.set(key, value); });
export const getItemAsync = jest.fn(async (key: string) => storage.get(key) ?? null);
export const deleteItemAsync = jest.fn(async (key: string) => { storage.delete(key); });

export function __resetSecureStore() {
  setItemAsync.mockClear();
  getItemAsync.mockClear();
  deleteItemAsync.mockClear();
  storage.clear();
  getItemAsync.mockImplementation(async key => storage.get(key) ?? null);
}
