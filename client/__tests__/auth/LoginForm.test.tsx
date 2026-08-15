/**
 * LoginForm component tests.
 *
 * Verifies the controlled form contract: input changes, password visibility
 * toggle, submit/forgot callbacks, loading/disabled state, inline error
 * rendering, and accessibility labels.
 */

/// <reference types="jest" />

import React from "react";
import renderer from "react-test-renderer";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import LoginForm from "@/components/auth/LoginForm";
import themeReducer from "@/store/slices/themeSlice";
import { Text, TextInput, TouchableOpacity } from "react-native";

const textMock = Text as unknown as jest.Mock;
const textInputMock = TextInput as unknown as jest.Mock;
const touchableOpacityMock = TouchableOpacity as unknown as jest.Mock;

const store = configureStore({ reducer: { theme: themeReducer } });

type Props = React.ComponentProps<typeof LoginForm>;

function renderForm(overrides: Partial<Props> = {}) {
  const props: Props = {
    email: "",
    password: "",
    isLoading: false,
    error: null,
    onEmailChange: jest.fn(),
    onPasswordChange: jest.fn(),
    onSubmit: jest.fn(),
    onForgotPassword: jest.fn(),
    ...overrides,
  };

  renderer.act(() => {
    renderer.create(
      <Provider store={store}>
        <LoginForm {...props} />
      </Provider>,
    );
  });

  return { props };
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

const byLabel = (label: string) => (props: Record<string, unknown>) =>
  props.accessibilityLabel === label;

const byAutoComplete = (kind: string) => (props: Record<string, unknown>) =>
  props.autoComplete === kind;

function renderedText(matches: string) {
  return textMock.mock.calls.some(
    (call) => String(call[0]?.children ?? "").includes(matches),
  );
}

beforeEach(() => {
  textMock.mockClear();
  textInputMock.mockClear();
  touchableOpacityMock.mockClear();
});

describe("LoginForm", () => {
  it("renders email/password values and forwards changes", () => {
    const { props } = renderForm({
      email: "a@b.com",
      password: "secret1",
    });

    const emailInput = lastProps(
      textInputMock,
      byAutoComplete("email"),
    );
    const passwordInput = lastProps(
      textInputMock,
      byAutoComplete("password"),
    );
    expect(emailInput?.value).toBe("a@b.com");
    expect(passwordInput?.value).toBe("secret1");

    renderer.act(() => {
      emailInput!.onChangeText("new@b.com");
    });
    renderer.act(() => {
      passwordInput!.onChangeText("newpass1");
    });
    expect(props.onEmailChange).toHaveBeenCalledWith("new@b.com");
    expect(props.onPasswordChange).toHaveBeenCalledWith("newpass1");
  });

  it("toggles password visibility", () => {
    renderForm({ email: "a@b.com", password: "secret1" });

    const passwordInput = () =>
      lastProps(textInputMock, byAutoComplete("password"));
    expect(passwordInput()?.secureTextEntry).toBe(true);

    const show = lastProps(touchableOpacityMock, byLabel("Show password"));
    expect(show).toBeDefined();
    renderer.act(() => {
      show!.onPress();
    });

    expect(passwordInput()?.secureTextEntry).toBe(false);
    expect(
      lastProps(touchableOpacityMock, byLabel("Hide password")),
    ).toBeDefined();

    const hide = lastProps(touchableOpacityMock, byLabel("Hide password"));
    renderer.act(() => {
      hide!.onPress();
    });

    expect(passwordInput()?.secureTextEntry).toBe(true);
  });

  it("disables the submit button while fields are empty or loading", () => {
    renderForm();
    expect(
      lastProps(touchableOpacityMock, byLabel("Sign In"))?.disabled,
    ).toBe(true);

    renderForm({ email: "a@b.com", password: "secret1" });
    expect(
      lastProps(touchableOpacityMock, byLabel("Sign In"))?.disabled,
    ).toBe(false);

    renderForm({
      email: "a@b.com",
      password: "secret1",
      isLoading: true,
    });
    expect(
      lastProps(touchableOpacityMock, byLabel("Sign In"))?.disabled,
    ).toBe(true);
  });

  it("invokes onSubmit and onForgotPassword", () => {
    const { props } = renderForm({ email: "a@b.com", password: "secret1" });

    const signIn = lastProps(touchableOpacityMock, byLabel("Sign In"));
    renderer.act(() => {
      signIn!.onPress();
    });
    expect(props.onSubmit).toHaveBeenCalled();

    const forgot = lastProps(
      touchableOpacityMock,
      byLabel("Forgot password"),
    );
    renderer.act(() => {
      forgot!.onPress();
    });
    expect(props.onForgotPassword).toHaveBeenCalled();
  });

  it("renders the Redux error inline", () => {
    renderForm({
      email: "a@b.com",
      password: "secret1",
      error: "Invalid credentials",
    });
    expect(renderedText("Invalid credentials")).toBe(true);
  });

  it("exposes accessibility labels for its controls", () => {
    renderForm({ email: "a@b.com", password: "secret1" });

    expect(
      lastProps(textInputMock, byLabel("Email address")),
    ).toBeDefined();
    expect(
      lastProps(textInputMock, byLabel("Password")),
    ).toBeDefined();
    expect(
      lastProps(touchableOpacityMock, byLabel("Show password")),
    ).toBeDefined();
    expect(
      lastProps(touchableOpacityMock, byLabel("Forgot password")),
    ).toBeDefined();
    expect(
      lastProps(touchableOpacityMock, byLabel("Sign In")),
    ).toBeDefined();
  });
});
