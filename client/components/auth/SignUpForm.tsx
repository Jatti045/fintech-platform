import React, { useState } from "react";
import { Text, TextInput, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "@/hooks/useRedux";
import type { ISignupData } from "@/types/user/types";

export interface SignUpFormProps {
  isLoading: boolean;
  /** Receives the collected field values; the parent owns signup behavior. */
  onSubmit: (credentials: ISignupData) => void;
}

/**
 * Presentational signup form. Owns the transient form fields and the purely
 * local password-visibility toggles, then forwards the collected credentials
 * to `onSubmit`. It never talks to Redux, the API, or the router.
 */
export default function SignUpForm({ isLoading, onSubmit }: SignUpFormProps) {
  const { THEME } = useTheme();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const isDisabled =
    isLoading || !username || !email || !password || !confirmPassword;

  const handleSubmit = () => {
    if (isDisabled) return;
    onSubmit({ username, email, password, confirmPassword });
  };

  return (
    <View>
      {/* Form fields */}
      <View className="space-y-4 mb-6">
        {/* Username Input */}
        <View>
          <Text
            style={{ color: THEME.textPrimary }}
            className="text-sm font-medium mb-2"
          >
            Username
          </Text>
          <View className="relative">
            <TextInput
              style={{
                backgroundColor: THEME.inputBackground,
                borderColor: username ? THEME.primary : THEME.border,
                color: THEME.textPrimary,
                shadowColor: THEME.primary,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: username ? 0.1 : 0,
                shadowRadius: 8,
              }}
              className={`border-2 py-4 px-4 rounded-xl text-base ${
                username ? "border-opacity-50" : ""
              }`}
              placeholder="Choose a username"
              placeholderTextColor={THEME.placeholderText}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="username"
              accessibilityLabel="Username"
            />
            {username ? (
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

        {/* Email Input */}
        <View>
          <Text
            style={{ color: THEME.textPrimary }}
            className="text-sm font-medium mb-2 mt-2"
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
              className={`border-2 py-4 px-4 rounded-xl text-base ${
                email ? "border-opacity-50" : ""
              }`}
              placeholder="Enter your email"
              placeholderTextColor={THEME.placeholderText}
              value={email}
              onChangeText={setEmail}
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
            className="text-sm font-medium mb-2 mt-2"
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
              className={`border-2 py-4 px-4 pr-12 rounded-xl text-base ${
                password ? "border-opacity-50" : ""
              }`}
              placeholder="Create a password"
              placeholderTextColor={THEME.placeholderText}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoComplete="new-password"
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

        {/* Confirm Password Input */}
        <View>
          <Text
            style={{ color: THEME.textPrimary }}
            className="text-sm font-medium mb-2 mt-2"
          >
            Confirm Password
          </Text>
          <View className="relative">
            <TextInput
              style={{
                backgroundColor: THEME.inputBackground,
                borderColor: confirmPassword ? THEME.primary : THEME.border,
                color: THEME.textPrimary,
                shadowColor: THEME.primary,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: confirmPassword ? 0.1 : 0,
                shadowRadius: 8,
              }}
              className={`border-2 py-4 px-4 pr-12 rounded-xl text-base ${
                confirmPassword ? "border-opacity-50" : ""
              }`}
              placeholder="Confirm your password"
              placeholderTextColor={THEME.placeholderText}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showConfirmPassword}
              autoComplete="new-password"
              accessibilityLabel="Confirm password"
            />
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={
                showConfirmPassword
                  ? "Hide confirm password"
                  : "Show confirm password"
              }
              onPress={() => setShowConfirmPassword((visible) => !visible)}
              style={{
                position: "absolute",
                right: 16,
                top: "50%",
                marginTop: -12,
              }}
              className="p-1"
            >
              <Ionicons
                name={showConfirmPassword ? "eye-off" : "eye"}
                size={20}
                color={THEME.placeholderText}
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Sign Up Button */}
      <TouchableOpacity
        onPress={handleSubmit}
        disabled={isDisabled}
        accessibilityRole="button"
        accessibilityLabel="Create Account"
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
            {isLoading ? "Creating Account..." : "Create Account"}
          </Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

