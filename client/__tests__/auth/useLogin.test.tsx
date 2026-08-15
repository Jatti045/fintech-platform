/**
 * useLogin hook tests.
 *
 * Covers form validation, email normalization, successful/failed login,
 * loading state, and that failures are owned by Redux (loginError) rather
 * than duplicated in local state or a second alert.
 */

/// <reference types="jest" />

import React from "react";
import renderer from "react-test-renderer";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { AlertProvider } from "@/utils/themedAlert";
import { userAPI } from "@/api/user";
import { useLogin } from "@/hooks/auth/useLogin";
import userReducer from "@/store/slices/userSlice";
import themeReducer from "@/store/slices/themeSlice";
import { Text } from "react-native";

jest.mock("@/api/user", () => ({
  userAPI: {
    login: jest.fn(),
    signup: jest.fn(),
    logout: jest.fn(),
    deleteAccount: jest.fn(),
    getStoredToken: jest.fn(),
    getStoredUser: jest.fn(),
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

const mockedLogin = userAPI.login as jest.Mock;

type Login = ReturnType<typeof useLogin>;

function setup() {
  const store = configureStore({
    reducer: { user: userReducer, theme: themeReducer },
  });
  const captured: { current: Login | null } = { current: null };

  function Harness() {
    captured.current = useLogin();
    return null;
  }

  renderer.act(() => {
    renderer.create(
      <Provider store={store}>
        <AlertProvider>
          <Harness />
        </AlertProvider>
      </Provider>,
    );
  });

  return { captured, store };
}

/** Lets pending microtasks/macrotasks (and the async continuations) settle. */
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

const authPayload = {
  user: { id: "1", email: "user@test.com" },
  token: "tok",
};

function renderedText(matches: string) {
  return (Text as jest.Mock).mock.calls.some(
    (call) => String(call[0]?.children ?? "").includes(matches),
  );
}

beforeEach(() => {
  mockedLogin.mockReset();
  (Text as jest.Mock).mockClear();
});

describe("useLogin", () => {
  it("returns false without dispatching for an invalid email", async () => {
    const { captured } = setup();
    renderer.act(() => {
      captured.current!.setEmail("not-an-email");
      captured.current!.setPassword("secret1");
    });

    let result: boolean | undefined;
    await renderer.act(async () => {
      result = await captured.current!.handleLogin();
    });

    expect(result).toBe(false);
    expect(mockedLogin).not.toHaveBeenCalled();
    expect(renderedText("Validation Error")).toBe(true);
  });

  it("returns false without dispatching when the password is missing", async () => {
    const { captured } = setup();
    renderer.act(() => {
      captured.current!.setEmail("user@test.com");
      captured.current!.setPassword("");
    });

    let result: boolean | undefined;
    await renderer.act(async () => {
      result = await captured.current!.handleLogin();
    });

    expect(result).toBe(false);
    expect(mockedLogin).not.toHaveBeenCalled();
  });

  it("normalizes the email and dispatches the login thunk on success", async () => {
    mockedLogin.mockResolvedValue({ data: authPayload });
    const { captured, store } = setup();
    renderer.act(() => {
      captured.current!.setEmail("  User@Test.com ");
      captured.current!.setPassword("secret1");
    });

    let result: boolean | undefined;
    await renderer.act(async () => {
      result = await captured.current!.handleLogin();
    });

    expect(result).toBe(true);
    expect(mockedLogin).toHaveBeenCalledWith({
      email: "user@test.com",
      password: "secret1",
    });
    expect(store.getState().user.isAuthenticated).toBe(true);
    expect(store.getState().user.loginError).toBeNull();
  });

  it("returns false on failure and leaves the error to Redux", async () => {
    mockedLogin.mockRejectedValue(new Error("Invalid credentials"));
    const { captured, store } = setup();
    renderer.act(() => {
      captured.current!.setEmail("user@test.com");
      captured.current!.setPassword("secret1");
    });

    let result: boolean | undefined;
    await renderer.act(async () => {
      result = await captured.current!.handleLogin();
    });

    expect(result).toBe(false);
    expect(store.getState().user.isAuthenticated).toBe(false);
    expect(store.getState().user.loginError).toBe("Invalid credentials");
  });

  it("exposes isLoading from Redux while the request is in flight", async () => {
    let resolveLogin!: (value: unknown) => void;
    mockedLogin.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveLogin = resolve;
        }),
    );

    const { captured } = setup();
    renderer.act(() => {
      captured.current!.setEmail("user@test.com");
      captured.current!.setPassword("secret1");
    });

    let pending!: Promise<boolean>;
    renderer.act(() => {
      pending = captured.current!.handleLogin();
    });

    expect(captured.current!.isLoading).toBe(true);

    await renderer.act(async () => {
      resolveLogin({ data: authPayload });
      await pending;
      await flush();
    });

    expect(captured.current!.isLoading).toBe(false);
  });
});
