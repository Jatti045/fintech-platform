/**
 * Password recovery modal component tests.
 *
 * These modals are presentational: they own their input state and field-level
 * validation, then forward submissions/closing to the parent via callbacks.
 */

/// <reference types="jest" />

import React from "react";
import renderer from "react-test-renderer";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { AlertProvider } from "@/utils/themedAlert";
import ForgotPasswordModal from "@/components/auth/PasswordRecovery/ForgotPasswordModal";
import OTPModal from "@/components/auth/PasswordRecovery/OTPModal";
import ResetPasswordModal from "@/components/auth/PasswordRecovery/ResetPasswordModal";
import themeReducer from "@/store/slices/themeSlice";
import {
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
} from "react-native";

const textMock = Text as unknown as jest.Mock;
const textInputMock = TextInput as unknown as jest.Mock;
const touchableOpacityMock = TouchableOpacity as unknown as jest.Mock;
const touchableWithoutFeedbackMock =
  TouchableWithoutFeedback as unknown as jest.Mock;

const store = configureStore({ reducer: { theme: themeReducer } });

function render(ui: React.ReactElement) {
  let tree!: renderer.ReactTestRenderer;
  renderer.act(() => {
    tree = renderer.create(
      <Provider store={store}>
        <AlertProvider>{ui}</AlertProvider>
      </Provider>,
    );
  });
  return tree;
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

const byPlaceholder =
  (placeholder: string) => (props: Record<string, unknown>) =>
    props.placeholder === placeholder;

function renderedText(matches: string) {
  return textMock.mock.calls.some(
    (call) => String(call[0]?.children ?? "").includes(matches),
  );
}

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  textMock.mockClear();
  textInputMock.mockClear();
  touchableOpacityMock.mockClear();
  touchableWithoutFeedbackMock.mockClear();
});

describe("ForgotPasswordModal", () => {
  it("submits the trimmed email", async () => {
    const onSubmit = jest.fn();
    render(
      <ForgotPasswordModal visible onClose={jest.fn()} onSubmit={onSubmit} />,
    );

    const input = lastProps(
      textInputMock,
      byPlaceholder("you@example.com"),
    );
    renderer.act(() => {
      input!.onChangeText("  User@Test.com ");
    });

    const send = lastProps(touchableOpacityMock, byLabel("Send OTP"));
    await renderer.act(async () => {
      send!.onPress();
      await flush();
    });

    expect(onSubmit).toHaveBeenCalledWith("User@Test.com");
  });

  it("blocks an invalid email without submitting", () => {
    const onSubmit = jest.fn();
    render(
      <ForgotPasswordModal visible onClose={jest.fn()} onSubmit={onSubmit} />,
    );

    const input = lastProps(
      textInputMock,
      byPlaceholder("you@example.com"),
    );
    renderer.act(() => {
      input!.onChangeText("not-an-email");
    });

    const send = lastProps(touchableOpacityMock, byLabel("Send OTP"));
    renderer.act(() => {
      send!.onPress();
    });

    expect(onSubmit).not.toHaveBeenCalled();
    expect(renderedText("Please enter a valid email address")).toBe(true);
  });

  it("closes without confirmation via the close button", () => {
    const onClose = jest.fn();
    render(
      <ForgotPasswordModal visible onClose={onClose} onSubmit={jest.fn()} />,
    );

    const close = lastProps(touchableOpacityMock, byLabel("Close"));
    renderer.act(() => {
      close!.onPress();
    });

    expect(onClose).toHaveBeenCalled();
  });

  it("clears its email field when closed", () => {
    const tree = render(
      <ForgotPasswordModal visible onClose={jest.fn()} onSubmit={jest.fn()} />,
    );
    const input = lastProps(
      textInputMock,
      byPlaceholder("you@example.com"),
    );
    renderer.act(() => {
      input!.onChangeText("user@test.com");
    });

    // tree.update replaces the root, so the Provider/AlertProvider wrapper
    // must be included again.
    const wrapped = (visible: boolean) => (
      <Provider store={store}>
        <AlertProvider>
          <ForgotPasswordModal
            visible={visible}
            onClose={jest.fn()}
            onSubmit={jest.fn()}
          />
        </AlertProvider>
      </Provider>
    );

    renderer.act(() => {
      tree.update(wrapped(false));
    });
    renderer.act(() => {
      tree.update(wrapped(true));
    });

    const reopened = lastProps(
      textInputMock,
      byPlaceholder("you@example.com"),
    );
    expect(reopened?.value).toBe("");
  });
});

describe("OTPModal", () => {
  it("forwards the entered code to onVerify", async () => {
    const onVerify = jest.fn().mockResolvedValue(true);
    render(
      <OTPModal
        visible
        onClose={jest.fn()}
        email="user@test.com"
        onVerify={onVerify}
      />,
    );

    const input = lastProps(textInputMock, byLabel("One-time code"));
    renderer.act(() => {
      input!.onChangeText("123456");
    });

    const send = lastProps(touchableOpacityMock, byLabel("Send OTP"));
    await renderer.act(async () => {
      send!.onPress();
      await flush();
    });

    expect(onVerify).toHaveBeenCalledWith("123456");
  });

  it("requires a code before verifying", () => {
    const onVerify = jest.fn();
    render(
      <OTPModal
        visible
        onClose={jest.fn()}
        email="user@test.com"
        onVerify={onVerify}
      />,
    );

    const send = lastProps(touchableOpacityMock, byLabel("Send OTP"));
    renderer.act(() => {
      send!.onPress();
    });

    expect(onVerify).not.toHaveBeenCalled();
    expect(renderedText("Please enter the code")).toBe(true);
  });

  it("confirms before closing", () => {
    const onClose = jest.fn();
    render(
      <OTPModal
        visible
        onClose={onClose}
        email="user@test.com"
        onVerify={jest.fn()}
      />,
    );

    const close = lastProps(touchableOpacityMock, byLabel("Close"));
    renderer.act(() => {
      close!.onPress();
    });

    expect(onClose).not.toHaveBeenCalled();
    expect(renderedText("Discard code?")).toBe(true);

    // The alert renders [Cancel, Leave] — the Leave button is the last
    // TouchableOpacity in the tree.
    const calls = touchableOpacityMock.mock.calls;
    const leave = calls[calls.length - 1][0];
    renderer.act(() => {
      leave!.onPress();
    });

    expect(onClose).toHaveBeenCalled();
  });
});



describe("ResetPasswordModal", () => {
  it("forwards both passwords to onSubmit", async () => {
    const onSubmit = jest.fn().mockResolvedValue(true);
    render(
      <ResetPasswordModal
        visible
        onClose={jest.fn()}
        email="user@test.com"
        otp="123456"
        onSubmit={onSubmit}
      />,
    );

    const newPw = lastProps(textInputMock, byLabel("New password"));
    const confirmPw = lastProps(
      textInputMock,
      byLabel("Confirm password"),
    );
    renderer.act(() => {
      newPw!.onChangeText("newpass1");
    });
    renderer.act(() => {
      confirmPw!.onChangeText("newpass1");
    });

    const save = lastProps(
      touchableWithoutFeedbackMock,
      byLabel("Save New Password"),
    );
    await renderer.act(async () => {
      save!.onPress();
      await flush();
    });

    expect(onSubmit).toHaveBeenCalledWith("newpass1", "newpass1");
  });

  it("blocks mismatched passwords before submitting", () => {
    const onSubmit = jest.fn();
    render(
      <ResetPasswordModal
        visible
        onClose={jest.fn()}
        email="user@test.com"
        otp="123456"
        onSubmit={onSubmit}
      />,
    );

    const newPw = lastProps(textInputMock, byLabel("New password"));
    const confirmPw = lastProps(
      textInputMock,
      byLabel("Confirm password"),
    );
    renderer.act(() => {
      newPw!.onChangeText("newpass1");
    });
    renderer.act(() => {
      confirmPw!.onChangeText("different");
    });

    const save = lastProps(
      touchableWithoutFeedbackMock,
      byLabel("Save New Password"),
    );
    renderer.act(() => {
      save!.onPress();
    });

    expect(onSubmit).not.toHaveBeenCalled();
    expect(renderedText("Passwords do not match")).toBe(true);
  });

  it("confirms before closing", () => {
    const onClose = jest.fn();
    render(
      <ResetPasswordModal
        visible
        onClose={onClose}
        email="user@test.com"
        otp="123456"
        onSubmit={jest.fn()}
      />,
    );

    const close = lastProps(touchableOpacityMock, byLabel("Close"));
    renderer.act(() => {
      close!.onPress();
    });

    expect(onClose).not.toHaveBeenCalled();
    expect(renderedText("Discard changes?")).toBe(true);

    const calls = touchableOpacityMock.mock.calls;
    const leave = calls[calls.length - 1][0];
    renderer.act(() => {
      leave!.onPress();
    });

    expect(onClose).toHaveBeenCalled();
  });
});

