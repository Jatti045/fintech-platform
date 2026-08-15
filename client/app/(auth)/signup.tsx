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
import { useThemedAlert } from "@/utils/themedAlert";
import { useSignUp } from "@/hooks/auth/useSignUp";
import SignUpForm from "@/components/auth/SignUpForm";
import GoogleAuthButton from "@/components/auth/GoogleAuthButton";
import Loader from "@/utils/loader";
import type { ISignupData } from "@/types/user/types";

/**
 * SignUpScreen is a composition/orchestration layer only:
 *
 *  - `useSignUp` owns signup behavior (validation, Redux dispatch, errors)
 *  - `SignUpForm` owns the form fields + local password-visibility state
 *  - `GoogleAuthButton` owns its own Google authentication
 *
 * The screen handles layout, responsive sizing, the success alert, and
 * navigation after a successful signup.
 */
const SignUpScreen = () => {
  const { THEME } = useTheme();
  const { showAlert } = useThemedAlert();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isSmallScreen = width < 380;
  const isTablet = width > 768;

  const signUp = useSignUp();

  const handleSignUp = async (credentials: ISignupData) => {
    const success = await signUp.handleSubmit(credentials);
    if (success) {
      showAlert({
        title: "Signup Successful",
        message: "Your account has been created. Please log in.",
      });
      router.replace("/(auth)/login");
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
                    Create your account to get started with budgeting.
                  </Text>
                </View>
              </View>

              {/* Sign Up Form */}
              <SignUpForm
                isLoading={signUp.isLoading}
                onSubmit={handleSignUp}
              />

              {/* Login Link */}
              <View className="items-center">
                <Text
                  style={{ color: THEME.textSecondary }}
                  className="text-base"
                >
                  Already have an account?{" "}
                  <Link href="/(auth)/login">
                    <Text
                      style={{
                        color: THEME.secondary,
                        fontWeight: "600",
                      }}
                    >
                      Sign In
                    </Text>
                  </Link>
                </Text>
              </View>
              <GoogleAuthButton />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      {signUp.isLoading && <Loader msg="Creating Account..." />}
    </SafeAreaView>
  );
};

export default SignUpScreen;
