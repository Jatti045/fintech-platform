/**
 * SignUpScreen integration tests.
 *
 * Verifies the screen composes the signup pieces correctly: navigation to
 * login + success alert on success, no navigation + error alert on failure,
 * loading state / duplicate-submission prevention, and the Google entry point.
 */

/// <reference types="jest" />

import React from "react";
import renderer from "react-test-renderer";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { AlertProvider } from "@/utils/themedAlert";
import { userAPI } from "@/api/user";
import { router } from "expo-router";
import SignUpScreen from "@/app/(auth)/signup";
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

const mockedSignup = userAPI.signup as jest.Mock;

function setup() {
  const store = configureStore({
    reducer: { user: userReducer, theme: themeReducer },
  });
  let tree!: renderer.ReactTestRenderer;
  renderer.act(() => {
    tree = renderer.create(
      <Provider store={store}>
        <AlertProvider>
          <SignUpScreen />
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

function fillFields() {
  const fill = (label: string, value: string) => {
    const input = lastProps(
      textInputMock,
      (props) => props.accessibilityLabel === label,
    );
    renderer.act(() => {
      input!.onChangeText(value);
    });
  };
  fill("Username", "budgeter");
  fill("Email address", "User@Test.com");
  fill("Password", "secret1");
  fill("Confirm password", "secret1");
}

function pressCreateAccount() {
  const button = lastProps(
    touchableOpacityMock,
    (props) => props.accessibilityLabel === "Create Account",
  );
  renderer.act(() => {
    button!.onPress();
  });
}

beforeEach(() => {
  mockedSignup.mockReset();
  (router.replace as jest.Mock).mockClear();
  textMock.mockClear();
  textInputMock.mockClear();
  touchableOpacityMock.mockClear();
});

describe("SignUpScreen", () => {
  it("navigates to login and shows the success alert on success", async () => {
    mockedSignup.mockResolvedValue({ data: {} });
    setup();

    fillFields();
    pressCreateAccount();

    await renderer.act(async () => {
      await flush();
    });

    expect(router.replace).toHaveBeenCalledWith("/(auth)/login");
    expect(renderedText("Signup Successful")).toBe(true);
    expect(renderedText("Your account has been created. Please log in.")).toBe(
      true,
    );
  });

  it("does not navigate and shows an error alert on failure", async () => {
    mockedSignup.mockRejectedValue(new Error("Email already registered"));
    setup();

    fillFields();
    pressCreateAccount();

    await renderer.act(async () => {
      await flush();
    });

    expect(router.replace).not.toHaveBeenCalled();
    expect(renderedText("Signup Failed")).toBe(true);
    expect(renderedText("Email already registered")).toBe(true);
  });

  it("represents the loading state and blocks duplicate submission", async () => {
    let resolveSignup!: (value: unknown) => void;
    mockedSignup.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSignup = resolve;
        }),
    );
    setup();

    fillFields();
    pressCreateAccount();

    // While the request is in flight the button is disabled and the loading
    // copy (button + full-screen Loader) is visible.
    expect(renderedText("Creating Account...")).toBe(true);
    expect(
      lastProps(
        touchableOpacityMock,
        (props) => props.accessibilityLabel === "Create Account",
      )?.disabled,
    ).toBe(true);

    await renderer.act(async () => {
      resolveSignup({ data: {} });
      await flush();
    });

    expect(router.replace).toHaveBeenCalledWith("/(auth)/login");
  });

  it("renders the Google authentication entry point", () => {
    setup();

    expect(
      lastProps(
        touchableOpacityMock,
        (props) => props.accessibilityLabel === "Continue with Google",
      ),
    ).toBeDefined();
  });
});
