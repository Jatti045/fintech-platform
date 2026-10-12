import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import { Platform } from "react-native";
import { gcm } from "@noble/ciphers/aes";
import { bytesToHex, hexToBytes, utf8ToBytes, bytesToUtf8 } from "@noble/ciphers/utils";

export const ENCRYPTED_CACHE_PREFIX = "financial-cache:v1:";
export const FINANCIAL_CACHE_KEY = "financialCacheKeyV1";
let operations: Promise<unknown> = Promise.resolve();
let migration: Promise<void> | null = null;

function serialize<T>(action: () => Promise<T>): Promise<T> {
  const result = operations.then(action);
  operations = result.catch(() => {});
  return result;
}

export function migrateLegacyFinancialCache(): Promise<void> {
  if (!migration) {
    migration = (async () => {
      const keys = await AsyncStorage.getAllKeys();
      await AsyncStorage.multiRemove(keys.filter(key =>
        key === "userData" || key === "dismissedRecurringSeries"
        || key.startsWith("rtkq:") || key.startsWith("transactions:") || key.startsWith("budgets:"),
      ));
    })().catch(error => { migration = null; throw error; });
  }
  return migration;
}

async function purgeCiphertext() {
  const keys = await AsyncStorage.getAllKeys();
  await AsyncStorage.multiRemove(keys.filter(key => key.startsWith(ENCRYPTED_CACHE_PREFIX)));
}

async function readKey(create: boolean): Promise<Uint8Array | null> {
  const raw = await SecureStore.getItemAsync(FINANCIAL_CACHE_KEY);
  if (raw && /^[0-9a-f]{64}$/.test(raw)) return hexToBytes(raw);
  if (raw) await SecureStore.deleteItemAsync(FINANCIAL_CACHE_KEY);
  if (!create) return null;
  await purgeCiphertext();
  const key = await Crypto.getRandomBytesAsync(32);
  await SecureStore.setItemAsync(FINANCIAL_CACHE_KEY, bytesToHex(key), {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  return key;
}

const storageKey = (owner: string, entry: string) =>
  `${ENCRYPTED_CACHE_PREFIX}${encodeURIComponent(owner)}:${entry}`;

export function writeEncryptedCache(owner: string, entry: string, value: unknown): Promise<void> {
  return serialize(async () => {
    await migrateLegacyFinancialCache();
    if (Platform.OS === "web") return;
    const key = await readKey(true);
    if (!key) return;
    try {
      const name = storageKey(owner, entry);
      const nonce = await Crypto.getRandomBytesAsync(12);
      const clear = utf8ToBytes(JSON.stringify(value));
      try {
        const ciphertext = gcm(key, nonce, utf8ToBytes(name)).encrypt(clear);
        await AsyncStorage.setItem(name, JSON.stringify({ v: 1, nonce: bytesToHex(nonce), ciphertext: bytesToHex(ciphertext) }));
      } finally { clear.fill(0); }
    } finally { key.fill(0); }
  });
}

export function readEncryptedCache<T>(owner: string, entry: string): Promise<T | null> {
  return serialize(async () => {
    try {
      await migrateLegacyFinancialCache();
      if (Platform.OS === "web") return null;
      const name = storageKey(owner, entry);
      const raw = await AsyncStorage.getItem(name);
      if (!raw) return null;
      const key = await readKey(false);
      if (!key) { await AsyncStorage.removeItem(name); return null; }
      try {
        const envelope = JSON.parse(raw);
        if (envelope.v !== 1 || !/^[0-9a-f]{24}$/.test(envelope.nonce)
            || typeof envelope.ciphertext !== "string") throw new Error("Invalid cache envelope");
        const clear = gcm(key, hexToBytes(envelope.nonce), utf8ToBytes(name)).decrypt(hexToBytes(envelope.ciphertext));
        try { return JSON.parse(bytesToUtf8(clear)) as T; }
        finally { clear.fill(0); }
      } catch {
        await AsyncStorage.removeItem(name);
        return null;
      } finally { key.fill(0); }
    } catch { return null; }
  });
}

export function clearEncryptedCache(): Promise<void> {
  return serialize(async () => {
    // Destroy the key even when storage cleanup fails.
    try { await purgeCiphertext(); }
    finally { await SecureStore.deleteItemAsync(FINANCIAL_CACHE_KEY); }
  });
}
