import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { AxiosError, type InternalAxiosRequestConfig } from "axios";
import apiClient from "@/config/apiClient";
import { store } from "@/store/store";
import api from "@/store/api/apiSlice";
import { userAPI } from "@/api/user";
import { loadUserFromStorage, loginUser, selectIsAuthenticated } from "@/store/slices/userSlice";
import { establishSession, invalidateSession, getSessionIdentity, withSessionGeneration } from "@/utils/session";
import { readEncryptedCache } from "@/utils/encryptedStorage";
import { FINANCIAL_CACHE_KEY, writeEncryptedCache } from "@/utils/encryptedStorage";

const user = { id: "user-A", email: "a@example.com" };
let token: string | null;
const unauthorized = (config: InternalAxiosRequestConfig) =>
  new AxiosError("Unauthorized", "ERR_BAD_REQUEST", config, undefined,
    { status: 401, statusText: "Unauthorized", headers: {}, config, data: {} });

async function authenticate(value: string) {
  await establishSession(value, user);
  store.dispatch(loginUser.fulfilled({ token: value, user } as any, "login", {} as any));
}

beforeEach(async () => {
  const protectedValues = new Map<string, string>();
  (SecureStore.getItemAsync as jest.Mock).mockImplementation(async key => key === "authToken" ? token : protectedValues.get(key) ?? null);
  (SecureStore.setItemAsync as jest.Mock).mockImplementation(async (key, value) => { if (key === "authToken") token = value; else protectedValues.set(key, value); });
  (SecureStore.deleteItemAsync as jest.Mock).mockImplementation(async key => { if (key === "authToken") token = null; else protectedValues.delete(key); });
  await invalidateSession();
  await AsyncStorage.clear();
  jest.clearAllMocks();
});

afterAll(async () => { await invalidateSession(); });

test("key loss refetches the authoritative profile while retaining the valid token", async () => {
  await authenticate("A");
  await SecureStore.deleteItemAsync(FINANCIAL_CACHE_KEY);
  const previous = apiClient.defaults.adapter;
  const calls: string[] = [];
  apiClient.defaults.adapter = async config => {
    calls.push(config.url!);
    return { status: 200, statusText: "OK", headers: {}, config, data: { success: true, data: user } };
  };
  try {
    expect(await userAPI.getStoredUser()).toEqual(user);
    expect(calls).toEqual(["/auth/me"]);
    expect(token).toBe("A");
  } finally { apiClient.defaults.adapter = previous; }
});

test("switching accounts destroys A's snapshots before B can hydrate", async () => {
  await authenticate("A");
  await writeEncryptedCache(user.id, "budget", [{ amount: 123 }]);
  const other = { id: "user-B", email: "b@example.com" };
  await establishSession("B", other);
  expect(await readEncryptedCache(user.id, "budget")).toBeNull();
  expect(await readEncryptedCache(other.id, "profile")).toEqual(other);
  expect((await getSessionIdentity())?.userId).toBe(other.id);
});

test("a successful password change clears the protected cache and session", async () => {
  await authenticate("A");
  const previous = apiClient.defaults.adapter;
  apiClient.defaults.adapter = async config => ({ status: 200, statusText: "OK", headers: {}, config, data: { success: true } });
  try {
    await userAPI.changePassword({ currentPassword: "old", newPassword: "new", confirmPassword: "new" });
    expect(token).toBeNull();
    expect(await SecureStore.getItemAsync(FINANCIAL_CACHE_KEY)).toBeNull();
    expect(await AsyncStorage.getAllKeys()).toEqual([]);
  } finally { apiClient.defaults.adapter = previous; }
});

test("HTTP failures do not log raw financial responses or authentication material", async () => {
  await authenticate("PRIVATE_AUTH_TOKEN");
  const log = jest.spyOn(console, "error").mockImplementation(() => {});
  const previous = apiClient.defaults.adapter;
  apiClient.defaults.adapter = async config => {
    throw new AxiosError("unavailable", "ERR_BAD_RESPONSE", config, undefined,
      { status: 500, statusText: "Error", headers: {}, config, data: { message: "unavailable", financial: "PRIVATE_FINANCIAL_PAYLOAD" } });
  };
  try {
    await expect(userAPI.updateCurrency("USD")).rejects.toThrow();
    expect(JSON.stringify(log.mock.calls)).not.toContain("PRIVATE_");
  } finally { apiClient.defaults.adapter = previous; log.mockRestore(); }
});

test("password-reset verification preserves the session; completing the reset clears it", async () => {
  await authenticate("A");
  const previous = apiClient.defaults.adapter;
  apiClient.defaults.adapter = async config => ({ status: 200, statusText: "OK", headers: {}, config, data: { success: true } });
  try {
    await userAPI.resetPassword({ email: user.email, otp: "123456", verifyOnly: true });
    expect(token).toBe("A");
    await userAPI.resetPassword({ email: user.email, otp: "123456", newPassword: "new", confirmPassword: "new" });
    expect(token).toBeNull();
    expect(await SecureStore.getItemAsync(FINANCIAL_CACHE_KEY)).toBeNull();
  } finally { apiClient.defaults.adapter = previous; }
});

test("expired restored session resets auth, API and persisted financial caches", async () => {
  await establishSession("expired", user);
  await store.dispatch(loadUserFromStorage());
  expect(selectIsAuthenticated(store.getState())).toBe(true);
  await store.dispatch(api.util.upsertQueryData("getBudgets", { currentMonth: 0, currentYear: 2026 }, []));
  for (const key of ["rtkq:v2:transactions:user-A:2026-0", "rtkq:v2:budgets:user-A:2026-0",
    "transactions:user-A:2026-0", "dismissedRecurringSeries", "authToken"]) {
    await AsyncStorage.setItem(key, "private-data");
  }
  await expect(apiClient.get("/transaction", { adapter: async config => { throw unauthorized(config); } })).rejects.toMatchObject({ status: 401 });
  expect(store.getState().user).toMatchObject({ user: null, token: null, isAuthenticated: false, isLoading: false });
  // AppRoutes uses this selector for tabs.redirect and the inverse for auth.redirect.
  expect(selectIsAuthenticated(store.getState())).toBe(false);
  expect(store.getState().api.queries).toEqual({});
  expect(store.getState().plaid.items).toEqual([]);
  expect(token).toBeNull();
  expect(await AsyncStorage.getAllKeys()).toEqual([]);
});

test("late A 401 cannot invalidate newly logged in B", async () => {
  await authenticate("A");
  let rejectOld!: () => void;
  let started!: () => void;
  const ready = new Promise<void>(resolve => { started = resolve; });
  const old = apiClient.get("/transaction", { adapter: config => new Promise((_resolve, reject) => {
    expect(config.headers.Authorization).toBe("Bearer A");
    rejectOld = () => reject(unauthorized(config));
    started();
  }) });
  const caught = old.catch(error => error);
  await ready;
  await authenticate("B");
  rejectOld();
  await caught;
  expect(token).toBe("B");
  expect(store.getState().user).toMatchObject({ token: "B", isAuthenticated: true });
  expect(token).toBe("B");
});

test("generation protects a new login even if the backend reuses the same token", async () => {
  await authenticate("same-token");
  const old = await getSessionIdentity();
  await authenticate("same-token");
  expect(await invalidateSession(old)).toBe(false);
  expect(store.getState().user.isAuthenticated).toBe(true);
});

test("simultaneous 401 responses clean up only once", async () => {
  await authenticate("A");
  const pending: (() => void)[] = [];
  let ready!: () => void;
  const started = new Promise<void>(resolve => { ready = resolve; });
  const requests = [1, 2, 3].map(() => apiClient.get("/transaction", { adapter: config => new Promise((_resolve, reject) => {
    pending.push(() => reject(unauthorized(config)));
    if (pending.length === 3) ready();
  }) }).catch(error => error));
  await started;
  pending.forEach(reject => reject());
  await Promise.all(requests);
  expect((SecureStore.deleteItemAsync as jest.Mock).mock.calls.filter(([key]) => key === "authToken")).toHaveLength(1);
  expect(store.getState().user.isAuthenticated).toBe(false);
});

test("public login and Google authentication 401s do not expire an existing session", async () => {
  await authenticate("A");
  for (const endpoint of ["/auth/login", "/auth/google"]) {
    await apiClient.post(endpoint, {}, { adapter: async config => {
      expect(config.headers.Authorization).toBeUndefined();
      throw unauthorized(config);
    } }).catch(() => {});
  }
  expect(token).toBe("A");
  expect(store.getState().user.isAuthenticated).toBe(true);
});

test("cleanup and new login persistence are serialized even while storage is stalled", async () => {
  await authenticate("A");
  const identity = await getSessionIdentity();
  let release!: () => void;
  let started!: () => void;
  const ready = new Promise<void>(resolve => { started = resolve; });
  (SecureStore.deleteItemAsync as jest.Mock).mockImplementationOnce(() => new Promise<void>(resolve => {
    release = () => { token = null; resolve(); };
    started();
  }));
  const expiry = invalidateSession(identity);
  await ready;
  const login = authenticate("B");
  expect(token).toBe("A");
  release();
  await Promise.all([expiry, login]);
  expect(token).toBe("B");
  expect(store.getState().user.isAuthenticated).toBe(true);
  expect(await AsyncStorage.getItem("userData")).toBeNull();
  expect(await readEncryptedCache(user.id, "profile")).toEqual(user);
});

test("late cache persistence cannot resurrect an expired session's data", async () => {
  await authenticate("A");
  const identity = (await getSessionIdentity())!;
  await invalidateSession(identity);
  const write = jest.fn(async () => AsyncStorage.setItem("rtkq:v2:budgets:user-A:2026-0", "private"));
  await withSessionGeneration(identity.generation, write);
  expect(write).not.toHaveBeenCalled();
});

test("explicit logout uses the same state and storage cleanup", async () => {
  await authenticate("A");
  await userAPI.logout();
  expect(token).toBeNull();
  expect(store.getState().user.isAuthenticated).toBe(false);
});


test("late successful financial responses cannot repopulate a new session's caches", async () => {
  await authenticate("A");
  let release!: () => void;
  let started!: () => void;
  const ready = new Promise<void>(resolve => { started = resolve; });
  const request = apiClient.get("/transaction", { adapter: config => new Promise(resolve => {
    release = () => resolve({ status: 200, statusText: "OK", config, headers: {}, data: { private: "A" } });
    started();
  }) }).catch(error => error);
  await ready;
  await authenticate("B");
  release();
  expect(await request).toMatchObject({ message: "Response belongs to an inactive session" });
  expect(token).toBe("B");
  expect(store.getState().user.isAuthenticated).toBe(true);
});
