import React from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import { formatCurrency } from "@/utils/helper";
import { useTheme } from "@/hooks/useRedux";
import type { IFinancialReport } from "@/types/financialSummary/types";

export default function ReportStatus({
  report,
  loading,
  error,
  stale,
  onRetry,
}: {
  report?: IFinancialReport;
  loading: boolean;
  error: unknown;
  stale: boolean;
  onRetry: () => void;
}) {
  const { THEME } = useTheme();
  const message = !report
    ? loading
      ? "Loading financial report…"
      : error
        ? "Could not load financial report."
        : "Financial report unavailable."
    : stale
      ? `Cached report from ${new Date(report.generatedAt).toLocaleString()}. ${error ? "Refresh failed." : "Refresh to confirm current figures."}`
      : report.transactionCount === 0
        ? "No income or spending recorded this month."
        : null;
  if (!message && !report?.expenseCredits) return null;
  return (
    <View accessibilityLiveRegion="polite" style={{ paddingVertical: 12 }}>
      {!report && loading && <ActivityIndicator color={THEME.primary} />}
      {message && (
        <Text style={{ color: error ? THEME.danger : THEME.textSecondary }}>
          {message}
        </Text>
      )}
      {(!report || stale) && !loading && (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Retry financial report"
          onPress={onRetry}
        >
          <Text style={{ color: THEME.primary, paddingVertical: 8 }}>
            Refresh report
          </Text>
        </TouchableOpacity>
      )}
      {report && report.expenseCredits > 0 && (
        <Text style={{ color: THEME.textSecondary }}>
          {formatCurrency(report.grossExpenses, report.currency)} expenses less{" "}
          {formatCurrency(report.expenseCredits, report.currency)} credits.
          Spending is net of refunds.
        </Text>
      )}
    </View>
  );
}
