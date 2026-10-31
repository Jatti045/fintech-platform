import React, { useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useRedux";
import { BRAND } from "@/constants/ThemePalettes";
import { formatCurrency } from "@/utils/helper";
import type { IRecurringPayment } from "@/types/recurring/types";
import DashboardCard from "./DashboardCard";
import DashboardSection from "./DashboardSection";
import DashboardState from "./DashboardState";

export interface UpcomingBillsCardProps {
  bills: IRecurringPayment[];
  currencyCode: string;
  onDismiss: (seriesKey: string) => void;
  onSeeAll?: () => void;
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
}
function ordinal(n: number) {
  const r = n % 100;
  return `${n}${r >= 11 && r <= 13 ? "th" : n % 10 === 1 ? "st" : n % 10 === 2 ? "nd" : n % 10 === 3 ? "rd" : "th"}`;
}
function shortDate(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "Date unavailable"
    : d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      });
}
export default function UpcomingBillsCard({
  bills,
  currencyCode,
  onDismiss,
  onSeeAll,
  loading,
  error,
  onRetry,
}: UpcomingBillsCardProps) {
  const { THEME } = useTheme();
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  return (
    <DashboardSection
      title="Upcoming Bills"
      action="See all upcoming bills"
      onPress={onSeeAll}
    >
      <DashboardCard paddingHorizontal={BRAND.spacing.md}>
        <Text
          style={{
            color: THEME.textSecondary,
            fontSize: 12,
            lineHeight: 19,
            paddingTop: BRAND.spacing.md,
          }}
        >
          Estimates based on recent activity, independent of the selected month.
        </Text>
        {error && (
          <DashboardState
            error
            message="Upcoming bills could not be refreshed."
            onRetry={onRetry}
          />
        )}
        {!bills.length && !error && (
          <DashboardState
            loading={loading}
            message={
              loading
                ? "Loading upcoming bills…"
                : "No upcoming bills detected. Estimates appear when there is enough recurring activity."
            }
          />
        )}
        {bills.map((bill, i) => {
          const expanded = expandedKey === bill.seriesKey;
          const currency = bill.currency || currencyCode;
          const estimate = `~${formatCurrency(bill.expectedAmount, currency)}`;
          const hint =
            bill.cadence === "MONTHLY" &&
            typeof bill.usualDayOfMonth === "number"
              ? `Usually around the ${ordinal(bill.usualDayOfMonth)}`
              : `Around ${shortDate(bill.nextExpectedDate)}`;
          return (
            <View
              key={bill.seriesKey}
              style={{
                paddingVertical: BRAND.spacing.md,
                borderBottomWidth: i < bills.length - 1 ? 1 : 0,
                borderBottomColor: THEME.border,
              }}
            >
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityState={{ expanded }}
                accessibilityLabel={`Bill ${bill.name}, ${estimate}`}
                onPress={() => setExpandedKey(expanded ? null : bill.seriesKey)}
                style={{ minHeight: BRAND.touchTarget }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: BRAND.spacing.sm,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        color: THEME.textPrimary,
                        fontSize: 15,
                        fontWeight: "600",
                      }}
                    >
                      {bill.name}
                    </Text>
                    <Text
                      style={{
                        color: THEME.textSecondary,
                        fontSize: 12,
                        marginTop: 4,
                      }}
                    >
                      Expected {shortDate(bill.nextExpectedDate)} ·{" "}
                      {bill.cadence.toLowerCase()}
                    </Text>
                  </View>
                  <Feather
                    name={expanded ? "chevron-up" : "chevron-down"}
                    size={18}
                    color={THEME.textSecondary}
                  />
                </View>
                <Text
                  style={{
                    color: THEME.textPrimary,
                    fontSize: 18,
                    fontWeight: "700",
                    fontVariant: ["tabular-nums"],
                    marginTop: BRAND.spacing.sm,
                  }}
                >
                  {estimate}
                </Text>
                <Text
                  style={{
                    color: THEME.textSecondary,
                    fontSize: 12,
                    lineHeight: 19,
                    marginTop: BRAND.spacing.xs,
                  }}
                >
                  {hint}
                </Text>
                {bill.confidence === "MEDIUM" && (
                  <Text
                    style={{ color: THEME.warning, fontSize: 11, marginTop: 4 }}
                  >
                    LOW CERTAINTY
                  </Text>
                )}
                {bill.amountChange && (
                  <Text
                    style={{
                      color: THEME.warning,
                      fontSize: 12,
                      lineHeight: 19,
                    }}
                  >
                    Amount changed · was{" "}
                    {formatCurrency(bill.amountChange.previousAmount, currency)}
                  </Text>
                )}
              </TouchableOpacity>
              {expanded && (
                <View
                  style={{
                    backgroundColor: THEME.subtleSurface,
                    borderRadius: BRAND.radius.input,
                    padding: BRAND.spacing.md,
                    marginTop: BRAND.spacing.sm,
                  }}
                >
                  <Text
                    style={{
                      color: THEME.textSecondary,
                      fontSize: 13,
                      lineHeight: 21,
                    }}
                  >
                    Based on {bill.occurrences} occurrences. Last seen{" "}
                    {shortDate(bill.lastOccurredDate)}. Dates and amounts are
                    estimates.
                  </Text>
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Close bill details"
                    onPress={() => setExpandedKey(null)}
                    style={{
                      minHeight: BRAND.touchTarget,
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ color: THEME.primary, fontWeight: "600" }}>
                      Close details
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={`Dismiss ${bill.name}`}
                    onPress={() => {
                      setExpandedKey(null);
                      onDismiss(bill.seriesKey);
                    }}
                    style={{
                      minHeight: BRAND.touchTarget,
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ color: THEME.textSecondary, fontSize: 13 }}>
                      Not a recurring bill
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        })}
      </DashboardCard>
    </DashboardSection>
  );
}
