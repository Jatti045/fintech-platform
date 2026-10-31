import React from "react";
import { Text, View } from "react-native";
import AuthScreen from "@/components/auth/AuthScreen";
import { BRAND } from "@/constants/ThemePalettes";
import { Link, router } from "expo-router";
import { useTheme } from "@/hooks/useRedux";
import { useLogin } from "@/hooks/auth/useLogin";
import { usePasswordRecovery } from "@/hooks/auth/usePasswordRecovery";
import LoginForm from "@/components/auth/LoginForm";
import GoogleAuthButton from "@/components/auth/GoogleAuthButton";
import ForgotPasswordModal from "@/components/auth/PasswordRecovery/ForgotPasswordModal";
import OTPModal from "@/components/auth/PasswordRecovery/OTPModal";
import ResetPasswordModal from "@/components/auth/PasswordRecovery/ResetPasswordModal";

/**
 * LoginScreen is a composition/orchestration layer only:
 *
 *  - `useLogin` owns the form state + login request (validation, Redux, errors)
 *  - `usePasswordRecovery` owns the forgot-password state machine
 *  - `LoginForm` / `GoogleAuthButton` / the recovery modals are presentational
 *
 * The screen connects them, uses the shared responsive AuthScreen layout,
 * and performs navigation after successful authentication.
 */
const LoginScreen = () => {
  const { THEME } = useTheme();

  const login = useLogin();
  const passwordRecovery = usePasswordRecovery();

  const handleLogin = async () => {
    const success = await login.handleLogin();
    if (success) {
      router.replace("/(tabs)");
    }
  };

  return (
    <AuthScreen
      title="Welcome back"
      description="Sign in to keep your finances in focus."
    >
      {/* Login Form */}
      <LoginForm
        email={login.email}
        password={login.password}
        isLoading={login.isLoading}
        error={login.loginError}
        onEmailChange={login.setEmail}
        onPasswordChange={login.setPassword}
        onSubmit={handleLogin}
        onForgotPassword={passwordRecovery.open}
      />

      <View
        style={{
          marginTop: BRAND.spacing.lg,
          flexDirection: "row",
          flexWrap: "wrap",
          justifyContent: "center",
          alignItems: "center",
          gap: BRAND.spacing.xs,
        }}
      >
        <Text style={{ color: THEME.textSecondary, fontSize: 14 }}>
          Don&apos;t have an account?
        </Text>
        <Link
          href="/(auth)/signup"
          accessibilityRole="link"
          style={{
            color: THEME.primary,
            fontSize: 14,
            fontWeight: "700",
            paddingVertical: BRAND.spacing.md,
            paddingHorizontal: BRAND.spacing.xs,
          }}
        >
          Sign Up
        </Link>
      </View>
      <GoogleAuthButton />

      {/* Password Recovery flow */}
      <ForgotPasswordModal
        visible={passwordRecovery.step === "email"}
        onClose={passwordRecovery.close}
        onSubmit={passwordRecovery.submitEmail}
      />

      <OTPModal
        visible={passwordRecovery.step === "otp"}
        onClose={passwordRecovery.close}
        email={passwordRecovery.email}
        onVerify={passwordRecovery.verifyOtp}
      />

      <ResetPasswordModal
        visible={passwordRecovery.step === "reset"}
        onClose={passwordRecovery.close}
        email={passwordRecovery.email}
        otp={passwordRecovery.otp}
        onSubmit={passwordRecovery.submitNewPassword}
      />
    </AuthScreen>
  );
};

export default LoginScreen;
