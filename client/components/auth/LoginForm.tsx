import React, { useState } from "react";
import { Text, TextInput, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "@/hooks/useRedux";

export interface LoginFormProps {
  email: string;
  password: string;
  isLoading: boolean;
  /** Persistent auth error surfaced from Redux (rendered inline). */
  error: string | null;
  onEmailChange: (email: string) => void;
  onPasswordChange: (password: string) => void;
  onSubmit: () => void;
  onForgotPassword: () => void;
}

/**
 * Presentational login form. Owns only purely-local UI state (password
 * visibility) and forwards every interaction through props — it never talks
 * to Redux, the API, or the router.
 */
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
  const [showPassword, setShowPassword] = useState(false);
  const isDisabled = isLoading || !email || !password;

  return (
    <View>
      {/* Form fields */}
      <View className="space-y-4 mb-6">
        {/* Error Message */}
        {error ? (
          <View
            style={{ backgroundColor: THEME.danger + "20" }}
            className="p-4 rounded-xl border border-red-200"
          >
            <Text style={{ color: THEME.danger }} className="text-sm text-center">
              {error}
            </Text>
          </View>
        ) : null}

        {/* Email Input */}
        <View>
          <Text
            style={{ color: THEME.textPrimary }}
            className="text-sm font-medium mb-2"
          >
            Email
          </Text>
          <View className="relative">
            <TextInput
              style={{
                backgroundColor: THEME.inputBackground,
                borderColor: email ? THEME.primary : THEME.border,
                color: THEME.textPrimary,
                shadowColor: THEME.primary,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: email ? 0.1 : 0,
                shadowRadius: 8,
              }}
              className={`border-2 py-4 px-4 leading-tight rounded-xl text-base ${
                email ? "border-opacity-50" : ""
              }`}
              placeholder="Enter your email"
              placeholderTextColor={THEME.placeholderText}
              value={email}
              onChangeText={onEmailChange}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              accessibilityLabel="Email address"
            />
            {email ? (
              <Ionicons
                name="checkmark-circle"
                size={20}
                color={THEME.success}
                style={{
                  position: "absolute",
                  right: 16,
                  top: "50%",
                  marginTop: -10,
                }}
              />
            ) : null}
          </View>
        </View>

        {/* Password Input */}
        <View>
          <Text
            style={{ color: THEME.textPrimary }}
            className="text-sm font-medium my-2"
          >
            Password
          </Text>
          <View className="relative">
            <TextInput
              style={{
                backgroundColor: THEME.inputBackground,
                borderColor: password ? THEME.primary : THEME.border,
                color: THEME.textPrimary,
                shadowColor: THEME.primary,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: password ? 0.1 : 0,
                shadowRadius: 8,
              }}
              className={`border-2 py-4 px-4 leading-tight pr-12 rounded-xl text-base ${
                password ? "border-opacity-50" : ""
              }`}
              placeholder="Enter your password"
              placeholderTextColor={THEME.placeholderText}
              value={password}
              onChangeText={onPasswordChange}
              secureTextEntry={!showPassword}
              autoComplete="password"
              accessibilityLabel="Password"
            />
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={
                showPassword ? "Hide password" : "Show password"
              }
              onPress={() => setShowPassword((visible) => !visible)}
              style={{
                position: "absolute",
                right: 16,
                top: "50%",
                marginTop: -12,
              }}
              className="p-1"
            >
              <Ionicons
                name={showPassword ? "eye-off" : "eye"}
                size={20}
                color={THEME.placeholderText}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Forgot Password */}
        <View className="items-end mt-2">
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Forgot password"
            onPress={onForgotPassword}
          >
            <Text
              style={{ color: THEME.secondary }}
              className="text-sm font-medium"
            >
              Forgot Password?
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Login Button */}
      <TouchableOpacity
        onPress={onSubmit}
        disabled={isDisabled}
        accessibilityRole="button"
        accessibilityLabel="Sign In"
        accessibilityState={{ disabled: isDisabled, busy: isLoading }}
        style={{ opacity: isDisabled ? 0.6 : 1 }}
        className="mb-8"
      >
        <LinearGradient
          colors={[THEME.primary, THEME.secondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{
            paddingVertical: 16,
            borderRadius: 12,
            shadowColor: THEME.primary,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
          }}
        >
          <Text
            style={{ color: THEME.textPrimary }}
            className="text-center text-lg font-semibold"
          >
            {isLoading ? "Signing In..." : "Sign In"}
          </Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

