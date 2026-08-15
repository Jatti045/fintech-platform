import { useCallback, useState } from "react";
import { useAppDispatch, useAppSelector } from "@/hooks/useRedux";
import {
  clearLoginError,
  loginUser,
  selectIsLoading,
  selectLoginError,
} from "@/store/slices/userSlice";
import { logger } from "@/utils/logger";
import { useThemedAlert } from "@/utils/themedAlert";
import { normalizeEmail, validateLoginForm } from "@/utils/validation";

/**
 * Owns the login form state and the orchestration for the login request.
 *
 * - Validation and email normalization run here via the shared utilities.
 * - The API call stays inside the Redux `loginUser` thunk — no direct API
 *   access from UI code.
 * - Failures are persisted to Redux (`loginError`) and exposed through the
 *   return value so the caller (screen) decides how to present them. No
 *   duplicate alert is fired alongside the inline Redux error.
 *
 * Returns `true` from `handleLogin` when authentication succeeded so the
 * caller can perform navigation as a one-off side effect.
 */
export const useLogin = () => {
  const dispatch = useAppDispatch();
  const { showAlert } = useThemedAlert();
  const isLoading = useAppSelector(selectIsLoading);
  const loginError = useAppSelector(selectLoginError);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = useCallback(async (): Promise<boolean> => {
    const check = validateLoginForm(email, password);
    if (!check.valid) {
      showAlert({ title: "Validation Error", message: check.message });
      return false;
    }

    dispatch(clearLoginError());

    try {
      await dispatch(
        loginUser({ email: normalizeEmail(email), password }),
      ).unwrap();
      return true;
    } catch (error) {
      // The rejection payload is already stored in Redux `loginError` and
      // rendered inline by LoginForm — logging only, no duplicate alert.
      logger.warn("Login", "Login failed", error);
      return false;
    }
  }, [dispatch, email, password, showAlert]);

  return {
    email,
    setEmail,
    password,
    setPassword,
    isLoading,
    loginError,
    handleLogin,
  };
};
