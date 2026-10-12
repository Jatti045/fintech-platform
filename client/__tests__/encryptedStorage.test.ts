import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { __resetSecureStore } from "../__mocks__/expo-secure-store";

let cache: typeof import("@/utils/encryptedStorage");
function restart() {
  jest.isolateModules(() => { cache = require("@/utils/encryptedStorage"); });
}
beforeEach(async () => {
  await AsyncStorage.clear();
  __resetSecureStore();
  jest.doMock("@react-native-async-storage/async-storage", () => ({ __esModule: true, default: AsyncStorage }));
  jest.doMock("expo-secure-store", () => SecureStore);
  restart();
});

test("AES-GCM round trips Unicode financial data while storage contains only ciphertext", async () => {
  const data = { category: "Café", amount: 128.25, email: "private@example.com" };
  await cache.writeEncryptedCache("A", "budget", data);
  const keys = await AsyncStorage.getAllKeys();
  const raw = (await AsyncStorage.getItem(keys[0]))!;
  expect(raw).not.toContain("private@example.com");
  expect(raw).not.toContain("128.25");
  expect(raw).not.toContain("Café");
  expect(await cache.readEncryptedCache("A", "budget")).toEqual(data);
  const first = raw;
  await cache.writeEncryptedCache("A", "budget", data);
  expect(await AsyncStorage.getItem(keys[0])).not.toEqual(first);
});

test("cache and protected key survive a module/application restart", async () => {
  await cache.writeEncryptedCache("A", "transactions", ["private financial data"]);
  restart();
  expect(await cache.readEncryptedCache("A", "transactions")).toEqual(["private financial data"]);
});

test("authenticated owner and entry name prevent ciphertext from being moved across users", async () => {
  await cache.writeEncryptedCache("A", "profile", { email: "A@example.com" });
  const key = (await AsyncStorage.getAllKeys())[0];
  await AsyncStorage.setItem(key.replace(":A:", ":B:"), (await AsyncStorage.getItem(key))!);
  expect(await cache.readEncryptedCache("B", "profile")).toBeNull();
  expect(await cache.readEncryptedCache("A", "profile")).toEqual({ email: "A@example.com" });
});

test("corrupted ciphertext is discarded instead of returning unauthenticated financial data", async () => {
  await cache.writeEncryptedCache("A", "budget", [123]);
  const key = (await AsyncStorage.getAllKeys())[0];
  const envelope = JSON.parse((await AsyncStorage.getItem(key))!);
  envelope.ciphertext = (envelope.ciphertext[0] === "0" ? "1" : "0") + envelope.ciphertext.slice(1);
  await AsyncStorage.setItem(key, JSON.stringify(envelope));
  expect(await cache.readEncryptedCache("A", "budget")).toBeNull();
  expect(await AsyncStorage.getItem(key)).toBeNull();
});

test.each([null, "invalid-key"])("lost or invalid key (%s) is a cache miss and the next write recovers", async value => {
  await cache.writeEncryptedCache("A", "budget", [123]);
  if (value === null) await SecureStore.deleteItemAsync(cache.FINANCIAL_CACHE_KEY);
  else await SecureStore.setItemAsync(cache.FINANCIAL_CACHE_KEY, value);
  expect(await cache.readEncryptedCache("A", "budget")).toBeNull();
  await cache.writeEncryptedCache("A", "budget", [456]);
  expect(await cache.readEncryptedCache("A", "budget")).toEqual([456]);
});

test("legacy migration invalidates all plaintext financial keys without deleting the valid token", async () => {
  for (const key of ["userData", "rtkq:v2:budgets:A:2026-0", "transactions:A:1", "budgets:A:1", "dismissedRecurringSeries"])
    await AsyncStorage.setItem(key, "private plaintext");
  await SecureStore.setItemAsync("authToken", "valid-session");
  await AsyncStorage.setItem("selectedTheme", "Light");
  await cache.migrateLegacyFinancialCache();
  await cache.migrateLegacyFinancialCache();
  expect(await AsyncStorage.getAllKeys()).toEqual(["selectedTheme"]);
  expect(await SecureStore.getItemAsync("authToken")).toBe("valid-session");
});

test("interrupted migration retries safely before any encrypted snapshot is written", async () => {
  await AsyncStorage.setItem("userData", "legacy plaintext");
  (AsyncStorage.multiRemove as jest.Mock).mockRejectedValueOnce(new Error("storage unavailable"));
  await expect(cache.writeEncryptedCache("A", "profile", {})).rejects.toThrow();
  expect(await AsyncStorage.getAllKeys()).toEqual(["userData"]);
  await cache.writeEncryptedCache("A", "profile", { id: "A" });
  expect(await AsyncStorage.getItem("userData")).toBeNull();
  expect(await cache.readEncryptedCache("A", "profile")).toEqual({ id: "A" });
});

test("cleanup destroys ciphertext and its key", async () => {
  await cache.writeEncryptedCache("A", "budget", [123]);
  await cache.clearEncryptedCache();
  expect(await AsyncStorage.getAllKeys()).toEqual([]);
  expect(await SecureStore.getItemAsync(cache.FINANCIAL_CACHE_KEY)).toBeNull();
});
