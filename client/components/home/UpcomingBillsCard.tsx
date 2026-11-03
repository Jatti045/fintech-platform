import React, { useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { useTheme } from "@/hooks/useRedux";
import { BRAND } from "@/constants/ThemePalettes";
import { formatCurrency } from "@/utils/helper";
import type { IRecurringPayment } from "@/types/recurring/types";
import ActivityIcon from "./ActivityIcon";
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
  const [showAll, setShowAll] = useState(false);
  const visibleBills = showAll ? bills : bills.slice(0, 2);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  return (
    <DashboardSection
      title="Upcoming Bills"
      action="See all upcoming bills"
      onPress={
        onSeeAll || (bills.length > 2 ? () => setShowAll(!showAll) : undefined)
      }
    >
      <View>
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
        {visibleBills.map((bill, i) => {
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
                paddingVertical: 8,
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
                  <ActivityIcon category={bill.name} />
                  <View style={{ flex: 1 }}>
                    <Text
                      numberOfLines={2}
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
                        marginTop: 2,
                      }}
                    >
                      {shortDate(bill.nextExpectedDate)}
                    </Text>
                  </View>
                  <Text
                    style={{
                      color: THEME.textPrimary,
                      fontSize: 15,
                      fontWeight: "700",
                      fontVariant: ["tabular-nums"],
                      flexShrink: 1,
                    }}
                  >
                    {estimate}
                  </Text>
                </View>
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
                      fontSize: 12,
                      lineHeight: 19,
                    }}
                  >
                    {hint} · {bill.cadence.toLowerCase()}
                  </Text>
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
              {i < visibleBills.length - 1 && (
                <View
                  style={{
                    height: 1,
                    backgroundColor: THEME.border,
                    opacity: 0.5,
                    marginLeft: 48,
                    marginTop: 8,
                  }}
                />
              )}
            </View>
          );
        })}
        <Text
          style={{
            color: THEME.textSecondary,
            fontSize: 11,
            lineHeight: 16,
            marginTop: 6,
            marginBottom: 4,
          }}
        >
          Estimates from recent activity, independent of the selected month.
        </Text>
        {showAll && !onSeeAll && (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Show fewer upcoming bills"
            onPress={() => setShowAll(false)}
            style={{ minHeight: 48, justifyContent: "center" }}
          >
            <Text style={{ color: THEME.primary, fontSize: 12 }}>
              Show fewer bills
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </DashboardSection>
  );
}
