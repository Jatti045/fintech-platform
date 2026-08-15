import { useCallback, useState } from "react";
import { useAppDispatch } from "@/hooks/useRedux";
import {
  forgotPassword,
  resetPassword,
} from "@/store/slices/userSlice";
import { logger } from "@/utils/logger";
import { useThemedAlert } from "@/utils/themedAlert";
import { normalizeEmail, validateResetPasswordForm } from "@/utils/validation";

export type RecoveryStep = "email" | "otp" | "reset";

export interface PasswordRecoveryState {
  step: RecoveryStep;
  email: string;
  otp: string;
}

/**
 * Owns the forgot-password workflow as a simple state machine:
 *
 *   (closed) → email → otp → reset → (closed)
 *
 * `null` means the flow is closed. Any non-null value describes exactly one
 * active step plus the data required for it, so impossible combinations like
 * "two recovery modals open at once" cannot be represented.
 *
 * Step transitions happen directly inside the event handlers (never via
 * effects), and every API call is dispatched through the Redux thunks.
 */
export const usePasswordRecovery = () => {
  const dispatch = useAppDispatch();
  const { showAlert } = useThemedAlert();

  const [flow, setFlow] = useState<PasswordRecoveryState | null>(null);

  const open = useCallback(() => {
    setFlow({ step: "email", email: "", otp: "" });
  }, []);

  const close = useCallback(() => {
    setFlow(null);
  }, []);

  /** Forgot-password step: request an OTP, then move to the OTP step. */
  const submitEmail = useCallback(
    async (rawEmail: string): Promise<boolean> => {
      const email = normalizeEmail(rawEmail);

      try {
        await dispatch(forgotPassword({ email })).unwrap();
      } catch (error) {
        // The endpoint rejects for unknown accounts; the UI intentionally
        // presents the same non-enumerating message in every case.
        logger.warn(
          "PasswordRecovery",
          "Forgot-password request failed",
          error,
        );
      }

      setFlow({ step: "otp", email, otp: "" });
      showAlert({
        title: "If an account exists, an OTP was sent to your email.",
      });
      return true;
    },
    [dispatch, showAlert],
  );

  /** OTP step: verify the code (verifyOnly) before moving to reset. */
  const verifyOtp = useCallback(
    async (otp: string): Promise<boolean> => {
      if (!flow) return false;

      try {
        const action = await dispatch(
          resetPassword({ email: flow.email, otp, verifyOnly: true }),
        ).unwrap();

        if (action?.success) {
          setFlow({ step: "reset", email: flow.email, otp });
          return true;
        }

        showAlert({
          title: "Invalid code",
          message: action?.message || "Please try again",
        });
        return false;
      } catch (error) {
        showAlert({
          title: "Invalid code",
          message: extractOtpMessage(error),
        });
        return false;
      }
    },
    [dispatch, flow, showAlert],
  );

  /** Reset step: set a new password, then close the whole flow. */
  const submitNewPassword = useCallback(
    async (newPassword: string, confirmPassword: string): Promise<boolean> => {
      const check = validateResetPasswordForm(newPassword, confirmPassword);
      if (!check.valid) {
        showAlert({ title: check.message! });
        return false;
      }

      if (!flow) return false;

      try {
        const action = await dispatch(
          resetPassword({
            email: flow.email,
            otp: flow.otp,
            newPassword,
            confirmPassword,
          }),
        ).unwrap();

        if (action?.success) {
          setFlow(null);
          showAlert({
            title: "Success",
            message: "Password reset successful",
          });
          return true;
        }

        showAlert({
          title: "Error",
          message: action?.message || "Failed to reset password",
        });
        return false;
      } catch (error) {
        showAlert({
          title: "Error",
          message:
            (error as { message?: string } | null)?.message ||
            "Failed to reset password",
        });
        return false;
      }
    },
    [dispatch, flow, showAlert],
  );

  return {
    step: flow?.step ?? null,
    email: flow?.email ?? "",
    otp: flow?.otp ?? "",
    open,
    close,
    submitEmail,
    verifyOtp,
    submitNewPassword,
  };
};

/** Flattens the shapes thrown by the API layer into a user-facing message. */
function extractOtpMessage(error: unknown): string {
  const e = error as {
    message?: string;
    response?: { data?: { message?: string } };
  } | null;
  return e?.message || e?.response?.data?.message || "Please try again";
}
