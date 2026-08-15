/**
 * usePasswordRecovery hook tests.
 *
 * Covers the recovery state machine transitions (email → otp → reset → closed),
 * email normalization, OTP verification success/failure, reset-password
 * submission, and the non-enumerating forgot-password behavior.
 */

/// <reference types="jest" />

import React from "react";
import renderer from "react-test-renderer";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { AlertProvider } from "@/utils/themedAlert";
import { userAPI } from "@/api/user";
import { usePasswordRecovery } from "@/hooks/auth/usePasswordRecovery";
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

const mockedForgotPassword = userAPI.forgotPassword as jest.Mock;
const mockedResetPassword = userAPI.resetPassword as jest.Mock;

type Recovery = ReturnType<typeof usePasswordRecovery>;

function setup() {
  const store = configureStore({
    reducer: { user: userReducer, theme: themeReducer },
  });
  const captured: { current: Recovery | null } = { current: null };

  function Harness() {
    captured.current = usePasswordRecovery();
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

  return { captured };
}

function renderedText(matches: string) {
  return (Text as jest.Mock).mock.calls.some(
    (call) => String(call[0]?.children ?? "").includes(matches),
  );
}

/** Drives the flow to the OTP step. */
async function goToOtp(captured: { current: Recovery | null }) {
  renderer.act(() => {
    captured.current!.open();
  });
  await renderer.act(async () => {
    await captured.current!.submitEmail("user@test.com");
  });
}

/** Drives the flow to the reset step with otp "123456". */
async function goToReset(captured: { current: Recovery | null }) {
  await goToOtp(captured);
  await renderer.act(async () => {
    await captured.current!.verifyOtp("123456");
  });
}

beforeEach(() => {
  mockedForgotPassword.mockReset();
  mockedResetPassword.mockReset();
  (Text as jest.Mock).mockClear();
  mockedForgotPassword.mockResolvedValue({
    success: true,
    message: "ok",
    data: null,
  });
  mockedResetPassword.mockResolvedValue({
    success: true,
    message: "ok",
    data: null,
  });
});

describe("usePasswordRecovery", () => {
  it("starts closed and opens at the email step", () => {
    const { captured } = setup();
    expect(captured.current!.step).toBeNull();

    renderer.act(() => {
      captured.current!.open();
    });

    expect(captured.current!.step).toBe("email");
    expect(captured.current!.email).toBe("");
  });

  it("normalizes the email, dispatches forgotPassword, and moves to OTP", async () => {
    const { captured } = setup();
    renderer.act(() => {
      captured.current!.open();
    });

    let ok: boolean | undefined;
    await renderer.act(async () => {
      ok = await captured.current!.submitEmail("  User@Test.com ");
    });

    expect(ok).toBe(true);
    expect(mockedForgotPassword).toHaveBeenCalledWith({
      email: "user@test.com",
    });
    expect(captured.current!.step).toBe("otp");
    expect(captured.current!.email).toBe("user@test.com");
    expect(
      renderedText("If an account exists, an OTP was sent to your email."),
    ).toBe(true);
  });

  it("still moves to OTP when forgotPassword rejects (non-enumerating UX)", async () => {
    mockedForgotPassword.mockRejectedValue(new Error("User not found"));
    const { captured } = setup();
    renderer.act(() => {
      captured.current!.open();
    });

    let ok: boolean | undefined;
    await renderer.act(async () => {
      ok = await captured.current!.submitEmail("missing@test.com");
    });

    expect(ok).toBe(true);
    expect(captured.current!.step).toBe("otp");
    expect(captured.current!.email).toBe("missing@test.com");
  });

  it("verifies a valid OTP and moves to the reset step", async () => {
    const { captured } = setup();
    await goToOtp(captured);

    let ok: boolean | undefined;
    await renderer.act(async () => {
      ok = await captured.current!.verifyOtp("123456");
    });

    expect(ok).toBe(true);
    expect(mockedResetPassword).toHaveBeenCalledWith({
      email: "user@test.com",
      otp: "123456",
      verifyOnly: true,
    });
    expect(captured.current!.step).toBe("reset");
    expect(captured.current!.otp).toBe("123456");
  });

  it("stays on the OTP step for an invalid OTP", async () => {
    mockedResetPassword.mockResolvedValue({
      success: false,
      message: "Invalid code",
      data: null,
    });
    const { captured } = setup();
    await goToOtp(captured);

    let ok: boolean | undefined;
    await renderer.act(async () => {
      ok = await captured.current!.verifyOtp("000000");
    });

    expect(ok).toBe(false);
    expect(captured.current!.step).toBe("otp");
    expect(renderedText("Invalid code")).toBe(true);
  });

  it("stays on the OTP step when verification rejects", async () => {
    mockedResetPassword.mockRejectedValue(new Error("Invalid code"));
    const { captured } = setup();
    await goToOtp(captured);

    let ok: boolean | undefined;
    await renderer.act(async () => {
      ok = await captured.current!.verifyOtp("000000");
    });

    expect(ok).toBe(false);
    expect(captured.current!.step).toBe("otp");
    expect(renderedText("Invalid code")).toBe(true);
  });

  it("submits the new password, resets the flow, and confirms success", async () => {
    const { captured } = setup();
    await goToReset(captured);

    let ok: boolean | undefined;
    await renderer.act(async () => {
      ok = await captured.current!.submitNewPassword("newpass1", "newpass1");
    });

    expect(ok).toBe(true);
    expect(mockedResetPassword).toHaveBeenCalledWith({
      email: "user@test.com",
      otp: "123456",
      newPassword: "newpass1",
      confirmPassword: "newpass1",
    });
    expect(captured.current!.step).toBeNull();
    expect(captured.current!.email).toBe("");
    expect(renderedText("Password reset successful")).toBe(true);
  });

  it("rejects invalid passwords before dispatching", async () => {
    const { captured } = setup();
    await goToReset(captured);

    let ok: boolean | undefined;
    await renderer.act(async () => {
      ok = await captured.current!.submitNewPassword("short", "short");
    });

    expect(ok).toBe(false);
    expect(mockedResetPassword).not.toHaveBeenCalledWith(
      expect.objectContaining({ newPassword: "short" }),
    );
  });

  it("close() returns to the closed state", async () => {
    const { captured } = setup();
    await goToReset(captured);

    renderer.act(() => {
      captured.current!.close();
    });

    expect(captured.current!.step).toBeNull();
  });
});

