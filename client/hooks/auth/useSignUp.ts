import { useCallback } from "react";
import { useAppDispatch, useAppSelector } from "@/hooks/useRedux";
import {
  clearSignupError,
  selectIsLoading,
  signupUser,
} from "@/store/slices/userSlice";
import { logger } from "@/utils/logger";
import { useThemedAlert } from "@/utils/themedAlert";
import { normalizeEmail, validateSignupForm } from "@/utils/validation";
import type { ISignupData } from "@/types/user/types";

/**
 * Owns signup/authentication behavior.
 *
 * Unlike `useLogin`, this hook deliberately owns no form state — `SignUpForm`
 * collects the raw field values and hands them to `handleSubmit(credentials)`.
 * The hook handles validation, email normalization, dispatching the
 * `signupUser` thunk, and presenting errors (via the themed alert, matching
 * the existing signup UX).
 *
 * Returns `true` from `handleSubmit` when signup succeeded so the caller
 * (screen) can show the success alert and navigate as one-off side effects.
 */
export const useSignUp = () => {
  const dispatch = useAppDispatch();
  const { showAlert } = useThemedAlert();
  const isLoading = useAppSelector(selectIsLoading);

  const handleSubmit = useCallback(
    async (credentials: ISignupData): Promise<boolean> => {
      const check = validateSignupForm(
        credentials.username,
        credentials.email,
        credentials.password,
        credentials.confirmPassword,
      );
      if (!check.valid) {
        showAlert({ title: "Validation Error", message: check.message });
        return false;
      }

      dispatch(clearSignupError());

      try {
        await dispatch(
          signupUser({
            username: credentials.username,
            email: normalizeEmail(credentials.email),
            password: credentials.password,
            confirmPassword: credentials.confirmPassword,
          }),
        ).unwrap();
        return true;
      } catch (error) {
        logger.warn("SignUp", "Signup failed", error);
        // Signup errors are presented via the themed alert (the Redux
        // `signupError` flag is set but not rendered inline by this screen).
        showAlert({
          title: "Signup Failed",
          message:
            typeof error === "string" && error
              ? error
              : "Network error. Please check your connection and try again.",
        });
        return false;
      }
    },
    [dispatch, showAlert],
  );

  return {
    isLoading,
    handleSubmit,
  };
};
