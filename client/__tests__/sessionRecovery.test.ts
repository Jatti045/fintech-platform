import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { AxiosError } from "axios";

const user = { id: "user-A", email: "a@example.com" };
let session: typeof import("@/utils/session");
let store: typeof import("@/store/store").store;
let actions: typeof import("@/store/slices/userSlice");
let userAPI: typeof import("@/api/user").userAPI;
let client: typeof import("@/config/apiClient").default;
let values: Map<string, string>;

beforeEach(async () => {
  jest.resetModules();
  values = new Map();
  jest.doMock("expo-secure-store", () => SecureStore);
  jest.doMock("@react-native-async-storage/async-storage", () => AsyncStorage);
  (SecureStore.getItemAsync as jest.Mock).mockImplementation(
    async (key) => values.get(key) ?? null,
  );
  (SecureStore.setItemAsync as jest.Mock).mockImplementation(
    async (key, value) => {
      values.set(key, value);
    },
  );
  (SecureStore.deleteItemAsync as jest.Mock).mockImplementation(async (key) => {
    values.delete(key);
  });
  await AsyncStorage.clear();
  session = await import("@/utils/session");
  store = (await import("@/store/store")).store;
  actions = await import("@/store/slices/userSlice");
  userAPI = (await import("@/api/user")).userAPI;
  client = (await import("@/config/apiClient")).default;
});

afterEach(() => {
  jest.useRealTimers();
});

async function authenticate() {
  await session.establishSession("A", user);
  store.dispatch(
    actions.loginUser.fulfilled(
      { token: "A", user } as any,
      "login",
      {} as any,
    ),
  );
}

const ok = (config: any) => ({
  status: 200,
  statusText: "OK",
  headers: {},
  config,
  data: { success: true, data: user },
});

it("restores a persisted session after process restart without fetching or refreshing a cached profile", async () => {
  await session.establishSession("A", user);
  jest.resetModules();
  const restartedStore = (await import("@/store/store")).store;
  const restartedActions = await import("@/store/slices/userSlice");
  const restartedClient = (await import("@/config/apiClient")).default;
  const adapter = jest.fn(async (config: any) => ok(config));
  restartedClient.defaults.adapter = adapter;
  await restartedStore.dispatch(restartedActions.loadUserFromStorage());
  expect(restartedStore.getState().user).toMatchObject({
    isAuthenticated: true,
    token: "A",
    user,
  });
  expect(adapter).not.toHaveBeenCalled();
});

it.each([503, 500, 403, "network", "timeout"])(
  "retains active authentication after a %s data request failure",
  async (status) => {
    await authenticate();
    await client
      .get("/transaction", {
        adapter: async (config) => {
          if (typeof status === "number")
            throw new AxiosError(
              "failed",
              "ERR_BAD_RESPONSE",
              config,
              undefined,
              { status, statusText: "Error", headers: {}, config, data: {} },
            );
          throw new AxiosError(
            "failed",
            status === "timeout" ? "ECONNABORTED" : "ERR_NETWORK",
            config,
          );
        },
      })
      .catch(() => {});
    expect(store.getState().user).toMatchObject({
      isAuthenticated: true,
      token: "A",
      isLoading: false,
    });
    expect(values.get("authToken")).toBe("A");
  },
);

it("does not send an anonymous request when cold-start secure storage is unavailable", async () => {
  values.set("authToken", "A");
  (SecureStore.getItemAsync as jest.Mock).mockRejectedValueOnce(
    new Error("temporarily locked"),
  );
  const adapter = jest.fn(async (config) => ok(config));
  await expect(client.get("/transaction", { adapter })).rejects.toMatchObject({
    message: "temporarily locked",
  });
  expect(adapter).not.toHaveBeenCalled();
  expect(values.get("authToken")).toBe("A");
});

it("restores after a secure-storage read failure without deleting the session", async () => {
  values.set("authToken", "A");
  (SecureStore.getItemAsync as jest.Mock).mockRejectedValueOnce(
    new Error("temporarily locked"),
  );
  await store.dispatch(actions.loadUserFromStorage());
  expect(store.getState().user).toMatchObject({
    isAuthenticated: false,
    isLoading: false,
    restoreError: "temporarily locked",
  });
  expect(values.get("authToken")).toBe("A");
  client.defaults.adapter = async (config) => ok(config);
  await store.dispatch(actions.loadUserFromStorage());
  expect(store.getState().user).toMatchObject({
    isAuthenticated: true,
    token: "A",
    restoreError: null,
  });
});

it("missing profile plus server outage is recoverable and retry retrieves the authoritative user", async () => {
  values.set("authToken", "A");
  client.defaults.adapter = async (config) => {
    throw new AxiosError("unavailable", "ERR_BAD_RESPONSE", config, undefined, {
      status: 503,
      statusText: "Unavailable",
      headers: {},
      config,
      data: {},
    });
  };
  await store.dispatch(actions.loadUserFromStorage());
  expect(store.getState().user).toMatchObject({
    isAuthenticated: false,
    isLoading: false,
    restoreError: "unavailable",
  });
  expect(values.get("authToken")).toBe("A");
  client.defaults.adapter = async (config) => ok(config);
  await store.dispatch(actions.loadUserFromStorage());
  expect(store.getState().user).toMatchObject({
    isAuthenticated: true,
    token: "A",
    user,
  });
});

it("a stalled secure read settles startup and ignores its late completion", async () => {
  jest.useFakeTimers();
  values.set("authToken", "A");
  let release!: (value: string) => void;
  (SecureStore.getItemAsync as jest.Mock).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  const restore = store.dispatch(actions.loadUserFromStorage());
  await jest.advanceTimersByTimeAsync(10_000);
  await restore;
  expect(store.getState().user).toMatchObject({
    isLoading: false,
    isAuthenticated: false,
  });
  expect(store.getState().user.restoreError).toContain(
    "temporarily unavailable",
  );
  release("A");
  await jest.advanceTimersByTimeAsync(0);
  expect(store.getState().user.isAuthenticated).toBe(false);
  expect(values.get("authToken")).toBe("A");
});

it("a late restore cannot resurrect authentication after invalidation", async () => {
  await authenticate();
  let release!: (value: any) => void;
  const gate = jest.spyOn(userAPI, "getStoredUser").mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  const restore = store.dispatch(actions.loadUserFromStorage());
  while (!release) await Promise.resolve();
  await session.invalidateSession();
  release(user);
  await restore;
  expect(store.getState().user).toMatchObject({
    isAuthenticated: false,
    token: null,
    isLoading: false,
  });
  gate.mockRestore();
});

it("late restore failure cannot sign out a newly established session", async () => {
  await authenticate();
  let reject!: (error: Error) => void;
  const gate = jest.spyOn(userAPI, "getStoredUser").mockImplementationOnce(
    () =>
      new Promise((_resolve, fail) => {
        reject = fail;
      }),
  );
  const restore = store.dispatch(actions.loadUserFromStorage());
  while (!reject) await Promise.resolve();
  await session.establishSession("B", user);
  store.dispatch(
    actions.loginUser.fulfilled({ token: "B", user } as any, "B", {} as any),
  );
  reject(new Error("late failure"));
  await restore;
  expect(store.getState().user).toMatchObject({
    isAuthenticated: true,
    token: "B",
  });
  gate.mockRestore();
});

it("cache persistence cannot block data requests or immediate invalid-session handling", async () => {
  await authenticate();
  let release!: () => void;
  const blocked = session.withSessionGeneration(
    session.sessionGeneration(),
    () =>
      new Promise<void>((resolve) => {
        release = resolve;
      }),
  );
  while (!release) await Promise.resolve();
  await client.get("/transaction", {
    adapter: async (config) => {
      expect(config.headers.Authorization).toBe("Bearer A");
      return ok(config);
    },
  });
  await expect(
    client.get("/transaction", {
      adapter: async (config) => {
        throw new AxiosError("expired", "ERR_BAD_REQUEST", config, undefined, {
          status: 401,
          statusText: "Unauthorized",
          headers: {},
          config,
          data: {},
        });
      },
    }),
  ).rejects.toMatchObject({ status: 401 });
  expect(store.getState().user).toMatchObject({
    isAuthenticated: false,
    token: null,
  });
  expect(await session.getSessionIdentity()).toBeNull();
  release();
  await blocked;
  await session.invalidateSession();
  expect(values.get("authToken")).toBeUndefined();
});

it("a resumed subscribed query retries failed reads with the same session", async () => {
  await authenticate();
  const api = (await import("@/store/api/apiSlice")).default;
  const requests: any[] = [];
  client.defaults.adapter = async (config) => {
    requests.push(config);
    if (requests.length === 1)
      throw new AxiosError("offline", "ERR_NETWORK", config);
    return { ...ok(config), data: { success: true, data: [] } };
  };
  const query = store.dispatch(
    api.endpoints.getBudgets.initiate({ currentMonth: 0, currentYear: 2026 }),
  );
  await query;
  store.dispatch(api.internalActions.onFocusLost());
  store.dispatch(api.internalActions.onFocus());
  await store.dispatch(api.util.getRunningQueriesThunk())[0];
  expect(requests).toHaveLength(2);
  expect(requests[1].headers.Authorization).toBe("Bearer A");
  expect(store.getState().user.isAuthenticated).toBe(true);
  query.unsubscribe();
  store.dispatch(api.util.resetApiState());
});


it("the overall restore deadline exits loading even if profile recovery never settles", async () => {
  jest.useFakeTimers();
  values.set("authToken", "A");
  const gate = jest.spyOn(userAPI, "getStoredUser").mockImplementationOnce(() => new Promise(() => {}));
  const restore = store.dispatch(actions.loadUserFromStorage());
  await jest.advanceTimersByTimeAsync(60_000);
  await restore;
  expect(store.getState().user).toMatchObject({ isLoading: false, isAuthenticated: false, restoreError: "Session loading timed out. Please retry." });
  expect(values.get("authToken")).toBe("A");
  gate.mockRestore();
});

it("an active session keeps sending its token when the device keychain becomes unavailable", async () => {
  await authenticate();
  (SecureStore.getItemAsync as jest.Mock).mockRejectedValue(new Error("device locked"));
  await client.get("/transaction", { adapter: async config => {
    expect(config.headers.Authorization).toBe("Bearer A");
    return ok(config);
  } });
  expect(store.getState().user.isAuthenticated).toBe(true);
});


it("confirmed invalid credentials during cold restoration show sign-in rather than a retry state", async () => {
  values.set("authToken", "expired");
  const adapter = jest.fn(async config => {
    throw new AxiosError("expired", "ERR_BAD_REQUEST", config, undefined,
      { status: 401, statusText: "Unauthorized", headers: {}, config, data: {} });
  });
  client.defaults.adapter = adapter;
  await store.dispatch(actions.loadUserFromStorage());
  expect(store.getState().user).toMatchObject({ isAuthenticated: false, token: null, isLoading: false });
  expect(store.getState().user.restoreError).toBeFalsy();
  expect(adapter).toHaveBeenCalledTimes(1);
  expect(adapter.mock.calls[0][0].url).toBe("/auth/me");
  await session.invalidateSession();
  expect(values.get("authToken")).toBeUndefined();
});
