import { Text, TouchableOpacity, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import React, { useEffect, useState } from "react";
import { useAppDispatch, useAuth, useTheme } from "@/hooks/useRedux";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { googleAuth } from "@/store/slices/userSlice";
import { useThemedAlert } from "@/utils/themedAlert";
import { router } from "expo-router";
import { BRAND } from "@/constants/ThemePalettes";

export default function GoogleAuthButton() {
  const { THEME } = useTheme();
  const { showAlert } = useThemedAlert();
  const dispatch = useAppDispatch();
  const { isLoading } = useAuth();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const disabled = isLoading || isSigningIn;

  const signInWithGoogle = async () => {
    if (disabled) return;
    setIsSigningIn(true);
    try {
      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();
      const idToken = userInfo.data?.idToken?.toString();

      if (idToken === undefined) {
        return;
      }

      const payload = await dispatch(googleAuth(idToken)).unwrap();
      if (payload?.success) {
        router.push("/(tabs)");
      } else {
        showAlert({
          title: "Error",
          message: payload.message || "Something went wrong",
        });
      }
    } catch (error) {
      // Native cancellation should quietly return to the form.
      if (
        typeof error === "object" &&
        error &&
        "code" in error &&
        error.code === "SIGN_IN_CANCELLED"
      )
        return;
      showAlert({
        title: "Google sign-in unavailable",
        message: "Please try again or sign in with your email and password.",
      });
    } finally {
      setIsSigningIn(false);
    }
  };

  useEffect(() => {
    GoogleSignin.configure({
      webClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    });
  }, []);

  return (
    <View className={"mt-6"}>
      <View className={"flex-row items-center justify-center gap-4 mb-6"}>
        <View style={{ flex: 1, height: 1, backgroundColor: THEME.border }} />
        <Text
          style={{
            color: THEME.textSecondary,
          }}
        >
          OR
        </Text>
        <View style={{ flex: 1, height: 1, backgroundColor: THEME.border }} />
      </View>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Continue with Google"
        disabled={disabled}
        accessibilityState={{ disabled, busy: isSigningIn }}
        style={{
          minHeight: 54,
          borderRadius: BRAND.radius.button,
          opacity: disabled ? 0.6 : 1,
          borderWidth: 1,
          borderColor: THEME.border,
          backgroundColor: THEME.inputBackground,
        }}
        onPress={signInWithGoogle}
        activeOpacity={0.8}
        className={"py-4 px-4"}
      >
        <View className={"flex-row items-center justify-center gap-2"}>
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            <Path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <Path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <Path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <Path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </Svg>
          <Text
            style={{
              color: THEME.textPrimary,
              flexShrink: 1,
              textAlign: "center",
            }}
            className={"text-base font-semibold"}
          >
            {isSigningIn ? "Connecting..." : "Continue With Google"}
          </Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}
