/**
 * LoginScreen integration tests.
 *
 * Verifies the screen composes the login + recovery pieces correctly:
 * navigation after successful login, inline (not duplicated) errors on
 * failure, and the forgot-password → OTP modal transition.
 */

/// <reference types="jest" />

import React from "react";
import renderer from "react-test-renderer";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { AlertProvider } from "@/utils/themedAlert";
import { userAPI } from "@/api/user";
import { router } from "expo-router";
import LoginScreen from "@/app/(auth)/login";
import userReducer from "@/store/slices/userSlice";
import themeReducer from "@/store/slices/themeSlice";
import { Text, TextInput, TouchableOpacity } from "react-native";

const textMock = Text as unknown as jest.Mock;
const textInputMock = TextInput as unknown as jest.Mock;
const touchableOpacityMock = TouchableOpacity as unknown as jest.Mock;

jest.mock("expo-router", () => ({
  Link: ({ children }: { children?: React.ReactNode }) => children,
  router: { replace: jest.fn(), push: jest.fn() },
}));

jest.mock("@react-native-google-signin/google-signin", () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn(),
    signIn: jest.fn(),
  },
}));

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
const mockedForgotPassword = userAPI.forgotPassword as jest.Mock;

function setup() {
  const store = configureStore({
    reducer: { user: userReducer, theme: themeReducer },
  });
  let tree!: renderer.ReactTestRenderer;
  renderer.act(() => {
    tree = renderer.create(
      <Provider store={store}>
        <AlertProvider>
          <LoginScreen />
        </AlertProvider>
      </Provider>,
    );
  });
  return { tree, store };
}

function lastProps(
  mock: jest.Mock,
  matcher: (props: Record<string, unknown>) => boolean,
): Record<string, any> | undefined {
  const calls = mock.mock.calls;
  for (let i = calls.length - 1; i >= 0; i--) {
    const props = calls[i]?.[0];
    if (props && matcher(props)) return props;
  }
  return undefined;
}

function renderedText(matches: string) {
  return textMock.mock.calls.some((call) => {
    const children = call[0]?.children;
    const text = Array.isArray(children)
      ? children.join("")
      : String(children ?? "");
    return text.includes(matches);
  });
}

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function fillAndSubmit(email: string, password: string) {
  const emailInput = lastProps(
    textInputMock,
    (props) => props.autoComplete === "email",
  );
  renderer.act(() => {
    emailInput!.onChangeText(email);
  });
  const passwordInput = lastProps(
    textInputMock,
    (props) => props.autoComplete === "password",
  );
  renderer.act(() => {
    passwordInput!.onChangeText(password);
  });

  const signIn = lastProps(
    touchableOpacityMock,
    (props) => props.accessibilityLabel === "Sign In",
  );
  return renderer.act(async () => {
    await signIn!.onPress();
    await flush();
  });
}

beforeEach(() => {
  mockedLogin.mockReset();
  mockedForgotPassword.mockReset();
  (router.replace as jest.Mock).mockClear();
  textMock.mockClear();
  textInputMock.mockClear();
  touchableOpacityMock.mockClear();
});

describe("LoginScreen", () => {
  it("navigates to the tabs after a successful login", async () => {
    mockedLogin.mockResolvedValue({
      data: { user: { id: "1", email: "user@test.com" }, token: "tok" },
    });
    setup();

    await fillAndSubmit("User@Test.com", "secret1");

    expect(mockedLogin).toHaveBeenCalledWith({
      email: "user@test.com",
      password: "secret1",
    });
    expect(router.replace).toHaveBeenCalledWith("/(tabs)");
  });

  it("does not navigate and shows the Redux error inline on failure", async () => {
    mockedLogin.mockRejectedValue(new Error("Invalid credentials"));
    setup();

    await fillAndSubmit("user@test.com", "secret1");

    expect(router.replace).not.toHaveBeenCalled();
    expect(renderedText("Invalid credentials")).toBe(true);
  });

  it("transitions from the forgot-password modal to the OTP modal", async () => {
    mockedForgotPassword.mockResolvedValue({
      success: true,
      message: "ok",
      data: null,
    });
    setup();

    const forgot = lastProps(
      touchableOpacityMock,
      (props) => props.accessibilityLabel === "Forgot password",
    );
    renderer.act(() => {
      forgot!.onPress();
    });

    // ForgotPasswordModal is now visible.
    const forgotEmail = lastProps(
      textInputMock,
      (props) => props.placeholder === "you@example.com",
    );
    expect(forgotEmail).toBeDefined();

    renderer.act(() => {
      forgotEmail!.onChangeText("user@test.com");
    });
    const sendOtp = lastProps(
      touchableOpacityMock,
      (props) => props.accessibilityLabel === "Send OTP",
    );
    await renderer.act(async () => {
      await sendOtp!.onPress();
      await flush();
    });

    // The OTP modal is now the visible step.
    expect(
      renderedText("Enter the 6-digit code sent to user@test.com"),
    ).toBe(true);
  });
});
