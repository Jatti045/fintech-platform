import React, { useRef, useState } from "react";
import { Text, TextInput, View } from "react-native";
import { BRAND } from "@/constants/ThemePalettes";
import { PASSWORD_MIN_LENGTH } from "@/constants/appConfig";
import { useTheme } from "@/hooks/useRedux";
import BrandInput from "@/components/brand/BrandInput";
import BrandButton from "@/components/brand/BrandButton";
import type { ISignupData } from "@/types/user/types";

export interface SignUpFormProps {
  isLoading: boolean;
  onSubmit: (credentials: ISignupData) => void;
}

export default function SignUpForm({ isLoading, onSubmit }: SignUpFormProps) {
  const { THEME } = useTheme();
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const disabled =
    isLoading || !username || !email || !password || !confirmPassword;
  const handleSubmit = () => {
    if (!disabled) onSubmit({ username, email, password, confirmPassword });
  };
  return (
    <View style={{ gap: BRAND.spacing.md }}>
      <BrandInput
        label="Username"
        placeholder="Choose a username"
        value={username}
        onChangeText={setUsername}
        autoComplete="username"
        editable={!isLoading}
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => emailRef.current?.focus()}
      />
      <BrandInput
        ref={emailRef}
        label="Email"
        accessibilityLabel="Email address"
        placeholder="Enter your email"
        value={email}
        onChangeText={setEmail}
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
        placeholder="Create a password"
        value={password}
        onChangeText={setPassword}
        password
        autoComplete="new-password"
        editable={!isLoading}
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => confirmRef.current?.focus()}
      />
      <Text
        style={{ color: THEME.textSecondary, fontSize: 13, lineHeight: 20 }}
      >
        Use at least {PASSWORD_MIN_LENGTH} characters.
      </Text>
      <BrandInput
        ref={confirmRef}
        label="Confirm Password"
        accessibilityLabel="Confirm password"
        placeholder="Confirm your password"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        password
        autoComplete="new-password"
        editable={!isLoading}
        returnKeyType="go"
        onSubmitEditing={handleSubmit}
      />
      <BrandButton
        label="Create Account"
        loadingLabel="Creating Account..."
        loading={isLoading}
        disabled={disabled}
        onPress={handleSubmit}
      />
    </View>
  );
}
