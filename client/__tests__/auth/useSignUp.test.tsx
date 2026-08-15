/**
 * useSignUp hook tests.
 *
 * Covers signup validation, email normalization, the dispatched `signupUser`
 * payload, success/failure handling, and loading state exposure.
 */

/// <reference types="jest" />

import React from "react";
import renderer from "react-test-renderer";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { AlertProvider } from "@/utils/themedAlert";
import { userAPI } from "@/api/user";
import { useSignUp } from "@/hooks/auth/useSignUp";
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

const mockedSignup = userAPI.signup as jest.Mock;

type SignUp = ReturnType<typeof useSignUp>;

function setup() {
  const store = configureStore({
    reducer: { user: userReducer, theme: themeReducer },
  });
  const captured: { current: SignUp | null } = { current: null };

  function Harness() {
    captured.current = useSignUp();
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

const validCredentials = {
  username: "budgeter",
  email: "  User@Test.com ",
  password: "secret1",
  confirmPassword: "secret1",
};

function renderedText(matches: string) {
  return (Text as jest.Mock).mock.calls.some((call) => {
    const children = call[0]?.children;
    const text = Array.isArray(children)
      ? children.join("")
      : String(children ?? "");
    return text.includes(matches);
  });
}

beforeEach(() => {
  mockedSignup.mockReset();
  (Text as jest.Mock).mockClear();
});

describe("useSignUp", () => {
  it("normalizes the email, dispatches signupUser, and returns true", async () => {
    mockedSignup.mockResolvedValue({ data: {} });
    const { captured, store } = setup();

    let result: boolean | undefined;
    await renderer.act(async () => {
      result = await captured.current!.handleSubmit(validCredentials);
    });

    expect(result).toBe(true);
    expect(mockedSignup).toHaveBeenCalledWith({
      username: "budgeter",
      email: "user@test.com",
      password: "secret1",
      confirmPassword: "secret1",
    });
    expect(store.getState().user.isLoading).toBe(false);
    expect(store.getState().user.signupError).toBeNull();
  });

  it("rejects an invalid email without dispatching", async () => {
    const { captured } = setup();

    let result: boolean | undefined;
    await renderer.act(async () => {
      result = await captured.current!.handleSubmit({
        ...validCredentials,
        email: "not-an-email",
      });
    });

    expect(result).toBe(false);
    expect(mockedSignup).not.toHaveBeenCalled();
    expect(renderedText("Validation Error")).toBe(true);
  });

  it("rejects a password mismatch without dispatching", async () => {
    const { captured } = setup();

    let result: boolean | undefined;
    await renderer.act(async () => {
      result = await captured.current!.handleSubmit({
        ...validCredentials,
        confirmPassword: "different",
      });
    });

    expect(result).toBe(false);
    expect(mockedSignup).not.toHaveBeenCalled();
    expect(renderedText("Passwords do not match")).toBe(true);
  });

  it("rejects an empty username without dispatching", async () => {
    const { captured } = setup();

    let result: boolean | undefined;
    await renderer.act(async () => {
      result = await captured.current!.handleSubmit({
        ...validCredentials,
        username: "",
      });
    });

    expect(result).toBe(false);
    expect(mockedSignup).not.toHaveBeenCalled();
  });

  it("returns false and presents the API error when signup fails", async () => {
    mockedSignup.mockRejectedValue(new Error("Email already registered"));
    const { captured, store } = setup();

    let result: boolean | undefined;
    await renderer.act(async () => {
      result = await captured.current!.handleSubmit(validCredentials);
    });

    expect(result).toBe(false);
    expect(store.getState().user.signupError).toBe("Email already registered");
    expect(renderedText("Signup Failed")).toBe(true);
    expect(renderedText("Email already registered")).toBe(true);
  });

  it("exposes isLoading from Redux while the request is in flight", async () => {
    let resolveSignup!: (value: unknown) => void;
    mockedSignup.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSignup = resolve;
        }),
    );
    const { captured } = setup();

    let pending!: Promise<boolean>;
    renderer.act(() => {
      pending = captured.current!.handleSubmit(validCredentials);
    });

    expect(captured.current!.isLoading).toBe(true);

    await renderer.act(async () => {
      resolveSignup({ data: {} });
      await pending;
      await flush();
    });

    expect(captured.current!.isLoading).toBe(false);
  });
});
