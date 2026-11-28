import FundleafLoader from "@/components/brand/FundleafLoader";
import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useRedux";
import { BRAND, TYPE } from "@/constants/ThemePalettes";

export default function DashboardState({
  loading,
  error,
  message,
  onRetry,
  compact = false,
}: {
  loading?: boolean;
  error?: boolean;
  message: string;
  onRetry?: () => void;
  compact?: boolean;
}) {
  const { THEME } = useTheme();

  return (
    <View
      accessibilityLiveRegion="polite"
      accessibilityState={{ busy: Boolean(loading) }}
      style={{
        paddingVertical: compact ? BRAND.spacing.sm : BRAND.spacing.md,
        gap: BRAND.spacing.sm,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: BRAND.spacing.sm,
        }}
      >
        {loading && !error && <FundleafLoader color={THEME.primary} />}
        {error && (
          <Feather name="alert-circle" size={16} color={THEME.danger} />
        )}
        <Text
          style={[
            compact ? TYPE.caption : TYPE.body,
            {
              color: error ? THEME.danger : THEME.textSecondary,
              flexShrink: 1,
            },
          ]}
        >
          {message}
        </Text>
      </View>
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
          <Text style={[TYPE.label, { color: THEME.primary }]}>Try again</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
