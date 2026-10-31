/**
 * RootLayout and AppRoutes Production Authentication and Routing Regression Tests.
 *
 * Verifies that the exported RootLayout renders AppRoutes (preventing the critical
 * bug where a naked Stack was rendered instead of AppRoutes, exposing Home to
 * unauthenticated users after reinstall or storage clear).
 *
 * Covers:
 *  - Fresh installation without a token
 *  - Valid stored session cold start
 *  - Expired or invalid session (401)
 *  - Failed authentication restoration (storage exceptions)
 *  - Successful login transitions
 *  - Logout and subsequent navigation
 *  - Authenticated API access
 *  - Cold startup gating
 */

/// <reference types="jest" />

import React from "react";
import renderer, { act } from "react-test-renderer";
import { ActivityIndicator } from "react-native";
import { Stack } from "expo-router";
import RootLayout, { AppRoutes } from "@/app/_layout";
import { userAPI } from "@/api/user";
import { store as appStore } from "@/store/store";
import { loginUser, logoutUser, loadUserFromStorage } from "@/store/slices/userSlice";
import apiClient from "@/config/apiClient";
import { AxiosError } from "axios";
import * as SecureStore from "expo-secure-store";
import { establishSession, invalidateSession, getSessionIdentity } from "@/utils/session";
import { hydrateApiCache } from "@/store/api/cachePersistence";
import type { IUser } from "@/types/user/types";

jest.mock("expo-router", () => {
  const React = require("react");
  const { View } = require("react-native");
  const Stack = ({ children }: any) => React.createElement(View, null, children);
  Stack.Screen = jest.fn((_props: any) => null);
  return { Stack };
});

jest.mock("@/hooks/useNotifications", () => ({
  useNotifications: () => {},
}));

jest.mock("@/store/api/cachePersistence", () => ({
  apiCachePersistenceMiddleware: {
    middleware: jest.fn(
      () => (next: (action: any) => any) => (action: any) => next(action),
    ),
  },
  hydrateApiCache: jest.fn(),
}));

let mockSecureStoreToken: string | null = null;
const mockSecureStoreValues = new Map<string, string>();

jest.mock("@/api/user", () => ({
  userAPI: {
    login: jest.fn(),
    signup: jest.fn(),
    logout: jest.fn(async () => {
      const { invalidateSession } = require("@/utils/session");
      await invalidateSession();
    }),
    deleteAccount: jest.fn(),
    getStoredToken: jest.fn(),
    getStoredUser: jest.fn(),
    getMonthlyIncome: jest.fn(),
    uploadProfilePictureById: jest.fn(),
    deleteProfilePictureById: jest.fn(),
    changePassword: jest.fn(),
    updateCurrency: jest.fn(),
    updateMonthlyIncome: jest.fn(),
    forgotPassword: jest.fn(),
    resetPassword: jest.fn(),
    googleAuth: jest.fn(),
  },
}));

const mockedGetStoredToken = userAPI.getStoredToken as jest.Mock;
const mockedGetStoredUser = userAPI.getStoredUser as jest.Mock;
const mockedHydrateApiCache = hydrateApiCache as jest.Mock;

const testUser: IUser = {
  id: "prod-user-1",
  username: "Production User",
  email: "prod@fundleaf.app",
};

const lastScreenProps = (name: string) => {
  const calls = ((Stack as any).Screen as jest.Mock).mock.calls;
  for (let i = calls.length - 1; i >= 0; i--) {
    const props = calls[i][0];
    if (props?.name === name) return props;
  }
  return undefined;
};

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

async function until(pred: () => boolean, tries = 300) {
  for (let i = 0; i < tries; i++) {
    let ok = false;
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 2));
      ok = pred();
    });
    if (ok) return;
  }
  throw new Error("timed out waiting for expected state");
}

beforeEach(async () => {
  ((Stack as any).Screen as jest.Mock).mockClear();
  mockedGetStoredToken.mockReset();
  mockedGetStoredUser.mockReset();
  mockedHydrateApiCache.mockClear();

  mockSecureStoreToken = null;
  mockSecureStoreValues.clear();

  (SecureStore.getItemAsync as jest.Mock).mockImplementation(async (key: string) =>
    key === "authToken" ? mockSecureStoreToken : mockSecureStoreValues.get(key) ?? null,
  );
  (SecureStore.setItemAsync as jest.Mock).mockImplementation(async (key: string, value: string) => {
    if (key === "authToken") mockSecureStoreToken = value;
    else mockSecureStoreValues.set(key, value);
  });
  (SecureStore.deleteItemAsync as jest.Mock).mockImplementation(async (key: string) => {
    if (key === "authToken") mockSecureStoreToken = null;
    else mockSecureStoreValues.delete(key);
  });

  await invalidateSession();
});

afterAll(async () => {
  await invalidateSession();
});

describe("RootLayout & AppRoutes Production Authentication and Routing", () => {
  it("renders AppRoutes from RootLayout and configures route redirects (regression test for naked Stack)", async () => {
    // When no stored session exists, RootLayout must render AppRoutes and
    // configure Stack.Screen redirect flags protecting (tabs).
    mockedGetStoredToken.mockResolvedValue(null);
    mockedGetStoredUser.mockResolvedValue(null);

    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<RootLayout />);
    });
    await until(() => appStore.getState().user.isLoading === false);

    await act(async () => {
      await flush();
    });

    // RootLayout MUST have mounted Stack.Screen with redirects configured!
    // A naked Stack would have zero calls to Stack.Screen with (tabs) and (auth).
    expect(lastScreenProps("(tabs)")).toBeDefined();
    expect(lastScreenProps("(auth)")).toBeDefined();
    expect(lastScreenProps("(tabs)")?.redirect).toBe(true);
    expect(lastScreenProps("(auth)")?.redirect).toBe(false);
    expect(lastScreenProps("dock-preview")?.redirect).toBe(true);

    act(() => tree.unmount());
  });

  it("fresh installation without a token displays login and never exposes authenticated routes", async () => {
    // Simulates clean install: SecureStore is empty.
    mockedGetStoredToken.mockResolvedValue(null);
    mockedGetStoredUser.mockResolvedValue(null);

    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<RootLayout />);
    });

    await until(() => appStore.getState().user.isLoading === false);

    expect(appStore.getState().user.isAuthenticated).toBe(false);
    expect(appStore.getState().user.token).toBeNull();
    expect(appStore.getState().user.user).toBeNull();

    // Route guards redirect away from (tabs) and to (auth)
    expect(lastScreenProps("(tabs)")?.redirect).toBe(true);
    expect(lastScreenProps("(auth)")?.redirect).toBe(false);

    // Cache hydration is never called for unauthenticated users
    expect(mockedHydrateApiCache).not.toHaveBeenCalled();

    act(() => tree.unmount());
  });

  it("valid stored session cold start restores session, hydrates cache, and exposes Home", async () => {
    // Simulates existing valid session in SecureStore.
    mockedGetStoredToken.mockResolvedValue("prod-valid-token-123");
    mockedGetStoredUser.mockResolvedValue(testUser);

    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<RootLayout />);
    });

    await until(() => appStore.getState().user.isAuthenticated === true);

    expect(appStore.getState().user.isAuthenticated).toBe(true);
    expect(appStore.getState().user.token).toBe("prod-valid-token-123");
    expect(appStore.getState().user.user).toEqual(testUser);

    // Route guards allow (tabs) and redirect away from (auth)
    expect(lastScreenProps("(tabs)")?.redirect).toBe(false);
    expect(lastScreenProps("(auth)")?.redirect).toBe(true);

    // Cache hydration called on successful restore
    expect(mockedHydrateApiCache).toHaveBeenCalledWith(appStore);

    act(() => tree.unmount());
  });

  it("expired or invalid session (401) clears session and redirects to login", async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue("expired-token");
    await establishSession("expired-token", testUser);
    mockedGetStoredToken.mockResolvedValue("expired-token");
    mockedGetStoredUser.mockResolvedValue(testUser);

    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<RootLayout />);
      await flush();
    });

    expect(lastScreenProps("(tabs)")?.redirect).toBe(false);
    expect(lastScreenProps("(auth)")?.redirect).toBe(true);

    // Backend returns 401 Unauthorized
    await act(async () => {
      await apiClient
        .get("/transaction", {
          adapter: async (config) => {
            throw new AxiosError(
              "Unauthorized",
              "ERR_BAD_REQUEST",
              config,
              undefined,
              {
                status: 401,
                statusText: "Unauthorized",
                headers: {},
                config,
                data: { message: "Token expired" },
              },
            );
          },
        })
        .catch(() => {});
    });

    // Session invalidated and user state cleared
    expect(appStore.getState().user.isAuthenticated).toBe(false);
    expect(appStore.getState().user.token).toBeNull();
    expect(lastScreenProps("(tabs)")?.redirect).toBe(true);
    expect(lastScreenProps("(auth)")?.redirect).toBe(false);

    act(() => tree.unmount());
  });

  it("failed authentication restoration (storage read error) gracefully redirects to login", async () => {
    // Simulates Android Keystore decryption failure / corrupted storage on reinstall
    mockedGetStoredToken.mockRejectedValue(new Error("Keystore key corrupted"));
    mockedGetStoredUser.mockResolvedValue(null);

    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<RootLayout />);
    });

    await until(() => appStore.getState().user.isLoading === false);

    expect(appStore.getState().user.isAuthenticated).toBe(false);
    expect(lastScreenProps("(tabs)")?.redirect).toBe(true);
    expect(lastScreenProps("(auth)")?.redirect).toBe(false);
    expect(mockedHydrateApiCache).not.toHaveBeenCalled();

    act(() => tree.unmount());
  });

  it("successful login navigates from auth to Home", async () => {
    mockedGetStoredToken.mockResolvedValue(null);
    mockedGetStoredUser.mockResolvedValue(null);

    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<RootLayout />);
    });

    await until(() => appStore.getState().user.isLoading === false);
    expect(lastScreenProps("(tabs)")?.redirect).toBe(true);
    expect(lastScreenProps("(auth)")?.redirect).toBe(false);

    // User logs in successfully
    await act(async () => {
      await establishSession("new-token-456", testUser);
      appStore.dispatch(
        loginUser.fulfilled(
          { user: testUser, token: "new-token-456" },
          "req-login",
          { email: "prod@fundleaf.app", password: "password" },
        ),
      );
    });

    expect(appStore.getState().user.isAuthenticated).toBe(true);
    expect(lastScreenProps("(tabs)")?.redirect).toBe(false);
    expect(lastScreenProps("(auth)")?.redirect).toBe(true);

    act(() => tree.unmount());
  });

  it("logout clears session immediately and redirects to login", async () => {
    mockedGetStoredToken.mockResolvedValue("active-token");
    mockedGetStoredUser.mockResolvedValue(testUser);

    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<RootLayout />);
    });

    await until(() => appStore.getState().user.isAuthenticated === true);
    expect(lastScreenProps("(tabs)")?.redirect).toBe(false);
    expect(lastScreenProps("(auth)")?.redirect).toBe(true);

    // User logs out
    await act(async () => {
      await appStore.dispatch(logoutUser());
    });

    expect(appStore.getState().user.isAuthenticated).toBe(false);
    expect(appStore.getState().user.token).toBeNull();
    expect(lastScreenProps("(tabs)")?.redirect).toBe(true);
    expect(lastScreenProps("(auth)")?.redirect).toBe(false);

    act(() => tree.unmount());
  });

  it("authenticated API access attaches token when authenticated and omits when unauthenticated", async () => {
    // 1. Unauthenticated state
    let capturedHeaders: any = null;
    await apiClient
      .get("/transaction", {
        adapter: async (config) => {
          capturedHeaders = config.headers;
          return { status: 200, statusText: "OK", headers: {}, config, data: {} };
        },
      })
      .catch(() => {});

    expect(capturedHeaders?.Authorization).toBeUndefined();

    // 2. Authenticated state
    await establishSession("session-auth-token-789", testUser);
    await apiClient
      .get("/transaction", {
        adapter: async (config) => {
          capturedHeaders = config.headers;
          return { status: 200, statusText: "OK", headers: {}, config, data: {} };
        },
      })
      .catch(() => {});

    expect(capturedHeaders?.Authorization).toBe("Bearer session-auth-token-789");
  });

  it("cold startup displays splash and does not expose protected routes before restoration completes", async () => {
    let resolveTokenPromise!: (token: string | null) => void;
    const tokenGate = new Promise<string | null>((res) => {
      resolveTokenPromise = res;
    });

    mockedGetStoredToken.mockReturnValue(tokenGate);
    mockedGetStoredUser.mockResolvedValue(testUser);

    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<RootLayout />);
    });

    // While restoration is in flight, splash indicator is shown and routes are gated
    expect(tree.root.findAllByType(ActivityIndicator).length).toBeGreaterThan(0);
    expect(appStore.getState().user.isAuthenticated).toBe(false);

    // Resolve the token gate
    await act(async () => {
      resolveTokenPromise("resolved-token");
      await flush();
    });

    await until(() => appStore.getState().user.isAuthenticated === true);

    expect(appStore.getState().user.isAuthenticated).toBe(true);
    expect(lastScreenProps("(tabs)")?.redirect).toBe(false);
    expect(lastScreenProps("(auth)")?.redirect).toBe(true);

    act(() => tree.unmount());
  });
});
