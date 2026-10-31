import React from "react";
import { Text, View } from "react-native";
import AuthScreen from "@/components/auth/AuthScreen";
import { BRAND } from "@/constants/ThemePalettes";
import { Link, router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "@/hooks/useRedux";
import { useThemedAlert } from "@/utils/themedAlert";
import { useSignUp } from "@/hooks/auth/useSignUp";
import SignUpForm from "@/components/auth/SignUpForm";
import GoogleAuthButton from "@/components/auth/GoogleAuthButton";
import { NOTIFICATION_ONBOARDING_STORAGE_KEY } from "@/constants/notifications";
import { logger } from "@/utils/logger";
import type { ISignupData } from "@/types/user/types";

/**
 * SignUpScreen is a composition/orchestration layer only:
 *
 *  - `useSignUp` owns signup behavior (validation, Redux dispatch, errors)
 *  - `SignUpForm` owns the form fields and shared inputs own password visibility
 *  - `GoogleAuthButton` owns its own Google authentication
 *
 * The screen handles layout, responsive sizing, the success alert, and
 * navigation after a successful signup.
 */
const SignUpScreen = () => {
  const { THEME } = useTheme();
  const { showAlert } = useThemedAlert();

  const signUp = useSignUp();

  const handleSignUp = async (credentials: ISignupData) => {
    const success = await signUp.handleSubmit(credentials);
    if (success) {
      // Mark the one-time notification onboarding prompt as pending so it can
      // be shown after the user logs in for the first time. Not mandatory —
      // the user can decline and enable later from Profile settings.
      try {
        await AsyncStorage.setItem(NOTIFICATION_ONBOARDING_STORAGE_KEY, "1");
      } catch (error) {
        logger.warn("SignUp", "Failed to mark notification onboarding", error);
      }
      showAlert({
        title: "Signup Successful",
        message: "Your account has been created. Please log in.",
      });
      router.replace("/(auth)/login");
    }
  };

  return (
    <AuthScreen
      title="Create your account"
      description="A little clarity for your everyday finances."
    >
      {/* Sign Up Form */}
      <SignUpForm isLoading={signUp.isLoading} onSubmit={handleSignUp} />

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
          Already have an account?
        </Text>
        <Link
          href="/(auth)/login"
          accessibilityRole="link"
          style={{
            color: THEME.primary,
            fontSize: 14,
            fontWeight: "700",
            paddingVertical: BRAND.spacing.md,
            paddingHorizontal: BRAND.spacing.xs,
          }}
        >
          Sign In
        </Link>
      </View>
      <GoogleAuthButton />
    </AuthScreen>
  );
};

export default SignUpScreen;
