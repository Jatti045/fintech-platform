import React from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import { useTheme } from "@/hooks/useRedux";
import { BRAND } from "@/constants/ThemePalettes";

/** Shared async feedback for independent Home sections; never renders invented amounts. */
export default function DashboardState({
  loading,
  error,
  message,
  onRetry,
}: {
  loading?: boolean;
  error?: boolean;
  message: string;
  onRetry?: () => void;
}) {
  const { THEME } = useTheme();
  return (
    <View
      accessibilityLiveRegion="polite"
      style={{ paddingVertical: BRAND.spacing.md, gap: BRAND.spacing.sm }}
    >
      {loading && (
        <View accessibilityLabel={message} accessibilityState={{ busy: true }}>
          <ActivityIndicator color={THEME.primary} />
          <View
            accessible={false}
            style={{
              height: 12,
              borderRadius: 6,
              width: "60%",
              backgroundColor: THEME.surfaceHover,
              marginTop: BRAND.spacing.md,
            }}
          />
          <View
            accessible={false}
            style={{
              height: 32,
              borderRadius: 8,
              width: "85%",
              backgroundColor: THEME.surfaceHover,
              marginTop: BRAND.spacing.sm,
            }}
          />
        </View>
      )}
      <Text
        style={{
          color: error ? THEME.danger : THEME.textSecondary,
          fontSize: 14,
          lineHeight: 21,
        }}
      >
        {message}
      </Text>
      {error && onRetry && (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={`Retry: ${message}`}
          onPress={onRetry}
          style={{
            minHeight: BRAND.touchTarget,
            justifyContent: "center",
            alignSelf: "flex-start",
          }}
        >
          <Text style={{ color: THEME.primary, fontWeight: "700" }}>
            Try again
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
