/**
 * SignUpForm component tests.
 *
 * The form owns its transient field values and password-visibility toggles,
 * then hands the collected credentials to `onSubmit`. It never talks to
 * Redux, the API, or the router.
 */

/// <reference types="jest" />

import React from "react";
import renderer from "react-test-renderer";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import SignUpForm from "@/components/auth/SignUpForm";
import themeReducer from "@/store/slices/themeSlice";
import { Text, TextInput, TouchableOpacity } from "react-native";

const textMock = Text as unknown as jest.Mock;
const textInputMock = TextInput as unknown as jest.Mock;
const touchableOpacityMock = TouchableOpacity as unknown as jest.Mock;

const store = configureStore({ reducer: { theme: themeReducer } });

type Props = React.ComponentProps<typeof SignUpForm>;

function renderForm(overrides: Partial<Props> = {}) {
  const props: Props = {
    isLoading: false,
    onSubmit: jest.fn(),
    ...overrides,
  };

  let tree!: renderer.ReactTestRenderer;
  renderer.act(() => {
    tree = renderer.create(
      <Provider store={store}>
        <SignUpForm {...props} />
      </Provider>,
    );
  });

  return { props, tree };
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

function renderedText(matches: string) {
  return textMock.mock.calls.some((call) => {
    const children = call[0]?.children;
    const text = Array.isArray(children)
      ? children.join("")
      : String(children ?? "");
    return text.includes(matches);
  });
}

function fillAllFields() {
  const fill = (label: string, value: string) => {
    const input = lastProps(textInputMock, byLabel(label));
    renderer.act(() => {
      input!.onChangeText(value);
    });
  };
  fill("Username", "budgeter");
  fill("Email address", "user@test.com");
  fill("Password", "secret1");
  fill("Confirm password", "secret1");
}

beforeEach(() => {
  textMock.mockClear();
  textInputMock.mockClear();
  touchableOpacityMock.mockClear();
});

describe("SignUpForm", () => {
  it("renders the four inputs with secure password fields", () => {
    renderForm();

    expect(lastProps(textInputMock, byLabel("Username"))).toBeDefined();
    expect(lastProps(textInputMock, byLabel("Email address"))).toBeDefined();
    expect(lastProps(textInputMock, byLabel("Password"))?.secureTextEntry).toBe(
      true,
    );
    expect(
      lastProps(textInputMock, byLabel("Confirm password"))?.secureTextEntry,
    ).toBe(true);
  });

  it("updates its fields as the user types", () => {
    renderForm();
    fillAllFields();

    expect(lastProps(textInputMock, byLabel("Username"))?.value).toBe(
      "budgeter",
    );
    expect(lastProps(textInputMock, byLabel("Email address"))?.value).toBe(
      "user@test.com",
    );
    expect(lastProps(textInputMock, byLabel("Password"))?.value).toBe(
      "secret1",
    );
    expect(
      lastProps(textInputMock, byLabel("Confirm password"))?.value,
    ).toBe("secret1");
  });

  it("toggles password visibility", () => {
    renderForm();
    const passwordInput = () =>
      lastProps(textInputMock, byLabel("Password"));
    expect(passwordInput()?.secureTextEntry).toBe(true);

    const show = lastProps(touchableOpacityMock, byLabel("Show password"));
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

  it("toggles confirm-password visibility", () => {
    renderForm();
    const confirmInput = () =>
      lastProps(textInputMock, byLabel("Confirm password"));
    expect(confirmInput()?.secureTextEntry).toBe(true);

    const show = lastProps(
      touchableOpacityMock,
      byLabel("Show confirm password"),
    );
    renderer.act(() => {
      show!.onPress();
    });

    expect(confirmInput()?.secureTextEntry).toBe(false);
    expect(
      lastProps(touchableOpacityMock, byLabel("Hide confirm password")),
    ).toBeDefined();
  });

  it("disables the button while fields are empty", () => {
    renderForm();
    expect(
      lastProps(touchableOpacityMock, byLabel("Create Account"))?.disabled,
    ).toBe(true);

    fillAllFields();
    expect(
      lastProps(touchableOpacityMock, byLabel("Create Account"))?.disabled,
    ).toBe(false);
  });

  it("disables the button and blocks submission while loading", () => {
    const { tree, props } = renderForm();
    fillAllFields();

    // Same form instance re-rendered with isLoading — field state persists.
    renderer.act(() => {
      tree.update(
        <Provider store={store}>
          <SignUpForm isLoading onSubmit={props.onSubmit} />
        </Provider>,
      );
    });

    expect(
      lastProps(touchableOpacityMock, byLabel("Create Account"))?.disabled,
    ).toBe(true);
    expect(renderedText("Creating Account...")).toBe(true);

    renderer.act(() => {
      lastProps(touchableOpacityMock, byLabel("Create Account"))!.onPress();
    });
    expect(props.onSubmit).not.toHaveBeenCalled();
  });

  it("submits the collected credentials", () => {
    const { props } = renderForm();
    fillAllFields();

    renderer.act(() => {
      lastProps(touchableOpacityMock, byLabel("Create Account"))!.onPress();
    });

    expect(props.onSubmit).toHaveBeenCalledWith({
      username: "budgeter",
      email: "user@test.com",
      password: "secret1",
      confirmPassword: "secret1",
    });
  });

  it("does not submit while disabled", () => {
    const { props } = renderForm();

    renderer.act(() => {
      lastProps(touchableOpacityMock, byLabel("Create Account"))!.onPress();
    });

    expect(props.onSubmit).not.toHaveBeenCalled();
  });

  it("exposes accessibility labels for its controls", () => {
    renderForm();

    expect(lastProps(textInputMock, byLabel("Username"))).toBeDefined();
    expect(lastProps(textInputMock, byLabel("Email address"))).toBeDefined();
    expect(lastProps(textInputMock, byLabel("Password"))).toBeDefined();
    expect(lastProps(textInputMock, byLabel("Confirm password"))).toBeDefined();
    expect(
      lastProps(touchableOpacityMock, byLabel("Show password")),
    ).toBeDefined();
    expect(
      lastProps(touchableOpacityMock, byLabel("Show confirm password")),
    ).toBeDefined();
    expect(
      lastProps(touchableOpacityMock, byLabel("Create Account")),
    ).toBeDefined();
  });
});

