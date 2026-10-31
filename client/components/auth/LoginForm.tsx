import React, { useRef } from "react";
import { Text, TextInput, TouchableOpacity, View } from "react-native";
import { useTheme } from "@/hooks/useRedux";
import { BRAND } from "@/constants/ThemePalettes";
import BrandInput from "@/components/brand/BrandInput";
import BrandButton from "@/components/brand/BrandButton";

export interface LoginFormProps {
  email: string;
  password: string;
  isLoading: boolean;
  error: string | null;
  onEmailChange: (email: string) => void;
  onPasswordChange: (password: string) => void;
  onSubmit: () => void;
  onForgotPassword: () => void;
}

export default function LoginForm({
  email,
  password,
  isLoading,
  error,
  onEmailChange,
  onPasswordChange,
  onSubmit,
  onForgotPassword,
}: LoginFormProps) {
  const { THEME } = useTheme();
  const passwordRef = useRef<TextInput>(null);
  return (
    <View style={{ gap: BRAND.spacing.md }}>
      {error ? (
        <View
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          style={{
            padding: BRAND.spacing.md,
            borderRadius: BRAND.radius.input,
            backgroundColor: THEME.errorSurface,
          }}
        >
          <Text style={{ color: THEME.danger, fontSize: 14, lineHeight: 21 }}>
            {error}
          </Text>
        </View>
      ) : null}
      <BrandInput
        label="Email"
        accessibilityLabel="Email address"
        placeholder="Enter your email"
        value={email}
        onChangeText={onEmailChange}
        keyboardType="email-address"
        autoComplete="email"
        editable={!isLoading}
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => passwordRef.current?.focus()}
      />
      <BrandInput
        ref={passwordRef}
        label="Password"
        placeholder="Enter your password"
        value={password}
        onChangeText={onPasswordChange}
        password
        autoComplete="password"
        editable={!isLoading}
        returnKeyType="go"
        onSubmitEditing={() => {
          if (!isLoading && email && password) onSubmit();
        }}
      />
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Forgot password"
        onPress={onForgotPassword}
        disabled={isLoading}
        style={{
          minHeight: BRAND.touchTarget,
          justifyContent: "center",
          alignSelf: "flex-end",
        }}
      >
        <Text style={{ color: THEME.primary, fontSize: 14, fontWeight: "600" }}>
          Forgot Password?
        </Text>
      </TouchableOpacity>
      <BrandButton
        label="Sign In"
        loadingLabel="Signing In..."
        loading={isLoading}
        disabled={!email || !password}
        onPress={onSubmit}
      />
    </View>
  );
}
