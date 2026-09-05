/**
 * Root-layout (AppRoutes) auth-gate tests.
 *
 * Regression coverage for "refreshing Profile navigates back to Home": the
 * splash must only replace the navigator while the session is being restored
 * (unauthenticated + loading). Once a user is authenticated, a temporary
 * loading/refetch state (e.g. Profile refresh) must leave the Stack mounted so
 * the active tab/route survives. Genuinely unauthenticated / session-invalid
 * states must still emit the (tabs)/(auth) redirect flags.
 *
 * The navigation container is mocked; these tests verify the ROUTING DECISION
 * the layout hands to expo-router (which screen is mounted, and the redirect
 * flags) rather than the container itself.
 */

/// <reference types="jest" />

import React from "react";
import renderer from "react-test-renderer";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { ActivityIndicator } from "react-native";
import { Stack } from "expo-router";
import { AppRoutes } from "@/app/_layout";
import { userAPI } from "@/api/user";
import userReducer, {
  loginUser,
  loadUserFromStorage,
} from "@/store/slices/userSlice";
import themeReducer from "@/store/slices/themeSlice";
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
  // keep store.ts working — it consumes this middleware at module scope.
  apiCachePersistenceMiddleware: {
    middleware: jest.fn(
      () => (next: (action: any) => any) => (action: any) => next(action),
    ),
  },
  hydrateApiCache: jest.fn(),
}));

jest.mock("@/api/user", () => ({
  userAPI: {
    login: jest.fn(),
    signup: jest.fn(),
    logout: jest.fn(),
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

const user: IUser = {
  id: "u1",
  username: "Test User",
  email: "user@test.com",
};

function makeStore() {
  return configureStore({
    reducer: {
      user: userReducer,
      theme: themeReducer,
    },
  });
}

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/** Resolves on demand, with a safety timeout so an unresolved gate can never wedge the suite. */
function gatedResponse(value: any, safetyMs = 500) {
  let resolveNow!: (v: any) => void;
  const timer = setTimeout(() => resolveNow(value), safetyMs);
  const promise = new Promise<any>((res) => {
    resolveNow = (v: any) => {
      clearTimeout(timer);
      res(v);
    };
  });
  return { promise, resolve: resolveNow };
}

/** Repeatedly act-flushes until the predicate holds (async thunk settlement). */
async function until(pred: () => boolean, tries = 300) {
  for (let i = 0; i < tries; i++) {
    let ok = false;
    await renderer.act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 2));
      ok = pred();
    });
    if (ok) return;
  }
  throw new Error("timed out waiting for expected store state");
}

function renderRoutes(store: ReturnType<typeof makeStore>) {
  let tree!: renderer.ReactTestRenderer;
  renderer.act(() => {
    tree = renderer.create(
      <Provider store={store}>
        <AppRoutes />
      </Provider>,
    );
  });
  return tree;
}

const lastScreenProps = (name: string) => {
  const calls = ((Stack as any).Screen as jest.Mock).mock.calls;
  for (let i = calls.length - 1; i >= 0; i--) {
    const props = calls[i][0];
    if (props?.name === name) return props;
  }
  return undefined;
};

beforeEach(() => {
  ((Stack as any).Screen as jest.Mock).mockClear();
  mockedGetStoredToken.mockReset();
  mockedGetStoredUser.mockReset();
});

describe("AppRoutes auth gate", () => {
  it("renders the splash while the unauthenticated session is restoring", async () => {
    const store = makeStore();
    const gate = gatedResponse({ token: "tok", user });
    mockedGetStoredToken.mockReturnValue(gate.promise);
    mockedGetStoredUser.mockResolvedValue(user);

    let tree!: renderer.ReactTestRenderer;
    await renderer.act(async () => {
      tree = renderer.create(
        <Provider store={store}>
          <AppRoutes />
        </Provider>,
      );
    });

    // Restore still in flight and no session exists yet: the navigator is
    // replaced by the splash spinner.
    expect(store.getState().user.isLoading).toBe(true);
    expect(store.getState().user.isAuthenticated).toBe(false);
    expect(tree.root.findAllByType(Stack)).toHaveLength(0);
    expect(tree.root.findAllByType(ActivityIndicator).length).toBeGreaterThan(0);

    await renderer.act(async () => {
      gate.resolve({ token: "tok", user });
      await flush();
    });
    await until(() => store.getState().user.isLoading === false);
    renderer.act(() => {
      tree.update(
        <Provider store={store}>
          <AppRoutes />
        </Provider>,
      );
    });

    // Restore finished: authenticated session, navigator back up.
    expect(store.getState().user.isAuthenticated).toBe(true);
    expect(tree.root.findAllByType(Stack).length).toBeGreaterThan(0);
  });

  it("keeps an authenticated user on the current route while loading (no splash)", async () => {
    const store = makeStore();
    const gate = gatedResponse({ token: "tok", user });
    mockedGetStoredToken.mockReturnValue(gate.promise);
    mockedGetStoredUser.mockResolvedValue(user);

    // Authenticated session; a mid-session re-load (e.g. Profile refresh)
    // flips the auth loading flag to true.
    renderer.act(() => {
      store.dispatch(
        loginUser.fulfilled(
          { user, token: "tok" },
          "req-1",
          { email: "user@test.com", password: "secret1" },
        ),
      );
      store.dispatch(loadUserFromStorage.pending("refresh-1", undefined));
    });
    expect(store.getState().user.isAuthenticated).toBe(true);
    expect(store.getState().user.isLoading).toBe(true);

    let tree!: renderer.ReactTestRenderer;
    await renderer.act(async () => {
      tree = renderer.create(
        <Provider store={store}>
          <AppRoutes />
        </Provider>,
      );
    });

    // Authenticated + loading → the navigator stays mounted (no splash), so
    // the active tab (Profile) is preserved.
    expect(tree.root.findAllByType(Stack).length).toBeGreaterThan(0);
    expect(tree.root.findAllByType(ActivityIndicator).length).toBe(0);

    await renderer.act(async () => {
      gate.resolve({ token: "tok", user });
      await flush();
    });
    await until(() => store.getState().user.isLoading === false);
    renderer.act(() => {
      tree.update(
        <Provider store={store}>
          <AppRoutes />
        </Provider>,
      );
    });
    expect(store.getState().user.isAuthenticated).toBe(true);
    expect(tree.root.findAllByType(Stack).length).toBeGreaterThan(0);
  });

  it("redirects genuinely unauthenticated users through the auth flow", async () => {
    const store = makeStore();
    // No stored session → boot restore rejects.
    mockedGetStoredToken.mockResolvedValue(null);
    mockedGetStoredUser.mockResolvedValue(null);

    let tree!: renderer.ReactTestRenderer;
    await renderer.act(async () => {
      tree = renderer.create(
        <Provider store={store}>
          <AppRoutes />
        </Provider>,
      );
    });
    await until(() => store.getState().user.isLoading === false);
    expect(store.getState().user.isAuthenticated).toBe(false);

    renderer.act(() => {
      tree.update(
        <Provider store={store}>
          <AppRoutes />
        </Provider>,
      );
    });

    // The Stack is up and its redirect flags send the (auth) flow to the
    // top — same behavior as before the change.
    expect(tree.root.findAllByType(Stack).length).toBeGreaterThan(0);
    expect(lastScreenProps("(tabs)")?.redirect).toBe(true);
    expect(lastScreenProps("(auth)")?.redirect).toBe(false);
  });
});