import React from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import type { ITheme } from "@/types/theme/types";
import { BRAND } from "@/constants/ThemePalettes";

export default function TransactionFeedback({
  theme: THEME,
  loading,
  updating,
  error,
  filtered,
  onRetry,
  onClear,
}: {
  theme: ITheme;
  loading?: boolean;
  updating?: boolean;
  error?: boolean;
  filtered?: boolean;
  onRetry?: () => void;
  onClear?: () => void;
}) {
  return (
    <View
      accessibilityLiveRegion="polite"
      style={{
        backgroundColor: THEME.surface,
        borderRadius: BRAND.radius.card,
        borderWidth: 1,
        borderColor: THEME.border,
        padding: BRAND.spacing.lg,
        marginTop: BRAND.spacing.md,
        gap: BRAND.spacing.sm,
      }}
    >
      {loading && (
        <>
          <ActivityIndicator size="large" color={THEME.primary} />
          <View
            accessible={false}
            style={{
              height: 14,
              width: "70%",
              backgroundColor: THEME.surfaceHover,
              borderRadius: 7,
              marginTop: BRAND.spacing.sm,
            }}
          />
          <View
            accessible={false}
            style={{
              height: 14,
              width: "90%",
              backgroundColor: THEME.surfaceHover,
              borderRadius: 7,
            }}
          />
        </>
      )}
      <Text
        style={{
          color: error ? THEME.danger : THEME.textPrimary,
          fontSize: 16,
          fontWeight: "600",
        }}
      >
        {error
          ? "Could not load transactions."
          : loading
            ? "Loading transactions…"
            : updating
              ? "Updating transactions…"
              : "No transactions match filters."}
      </Text>
      {!loading && !updating && (
        <Text
          style={{ color: THEME.textSecondary, fontSize: 14, lineHeight: 21 }}
        >
          {error
            ? "Your existing data is unchanged. Refresh the list to try again."
            : filtered
              ? "Try a different search or clear the filters to see more activity."
              : "There is no activity for this period. Add a transaction or choose another month."}
        </Text>
      )}
      {error && onRetry && (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Retry transactions"
          onPress={onRetry}
          style={{ minHeight: BRAND.touchTarget, justifyContent: "center" }}
        >
          <Text style={{ color: THEME.primary, fontWeight: "700" }}>
            Try again
          </Text>
        </TouchableOpacity>
      )}
      {!error && !loading && !updating && filtered && onClear && (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Reset search and filters"
          onPress={onClear}
          style={{ minHeight: BRAND.touchTarget, justifyContent: "center" }}
        >
          <Text style={{ color: THEME.primary, fontWeight: "700" }}>
            Reset search and filters
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
