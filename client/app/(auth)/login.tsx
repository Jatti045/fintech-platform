import React from "react";
import {
  KeyboardAvoidingView,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
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
 * The screen connects them, handles responsive layout via `useWindowDimensions`,
 * and performs navigation after successful authentication.
 */
const LoginScreen = () => {
  const { THEME } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isSmallScreen = width < 380;
  const isTablet = width > 768;

  const login = useLogin();
  const passwordRecovery = usePasswordRecovery();

  const handleLogin = async () => {
    const success = await login.handleLogin();
    if (success) {
      router.replace("/(tabs)");
    }
  };

  return (
    <SafeAreaView
      style={{ backgroundColor: THEME.background }}
      className="flex-1"
    >
      <KeyboardAvoidingView behavior="padding" className="flex-1">
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            paddingTop: insets.top,
            paddingBottom: Math.max(insets.bottom, 20),
          }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header Section */}
          <View
            className={`flex-1 justify-center px-6 ${isTablet ? "items-center" : ""}`}
          >
            <View className={`${isTablet ? "w-full max-w-lg" : "w-full"}`}>
              {/* App Title and Welcome */}
              <View className="items-center mb-8">
                <View className="mb-2">
                  <Text
                    style={{ color: THEME.textPrimary }}
                    className={`${isSmallScreen ? "text-3xl" : "text-4xl"} font-bold text-center mb-2`}
                  >
                    Budgee
                  </Text>
                  <Text
                    style={{ color: THEME.textSecondary }}
                    className={`${isSmallScreen ? "text-sm" : "text-base"} text-center leading-5`}
                  >
                    Welcome back! Please enter your details.
                  </Text>
                </View>
              </View>

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

              {/* Sign Up Link */}
              <View className="items-center">
                <Text
                  style={{ color: THEME.textSecondary }}
                  className="text-base"
                >
                  Don&apos;t have an account?{" "}
                  <Link href="/(auth)/signup">
                    <Text
                      style={{
                        color: THEME.secondary,
                        fontWeight: "600",
                      }}
                    >
                      Sign Up
                    </Text>
                  </Link>
                </Text>
              </View>
              <GoogleAuthButton />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

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
    </SafeAreaView>
  );
};

export default LoginScreen;
