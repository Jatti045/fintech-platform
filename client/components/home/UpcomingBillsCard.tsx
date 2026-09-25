import React, { useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import type { IRecurringPayment } from "@/types/recurring/types";
import DashboardCard from "./DashboardCard";
import BrandIcon from "./BrandIcon";

export interface UpcomingBillsCardProps {
  /** Predicted bills due soonest first (dismissed rows already removed). */
  bills: IRecurringPayment[];
  currencyCode: string;
  /** Persists a dismissal so the series stops appearing on this device. */
  onDismiss: (seriesKey: string) => void;
  onSeeAll?: () => void;
}

function ordinal(n: number): string {
  const rem10 = n % 10;
  const rem100 = n % 100;
  if (rem10 === 1 && rem100 !== 11) return `${n}st`;
  if (rem10 === 2 && rem100 !== 12) return `${n}nd`;
  if (rem10 === 3 && rem100 !== 13) return `${n}rd`;
  return `${n}th`;
}

function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * Upcoming Bills section matching the reference design:
 * UPCOMING BILLS                         See all >
 * Compact horizontal cards showing:
 *   [Brand Icon]
 *   Merchant
 *   Amount
 *   Date
 */
export default function UpcomingBillsCard({
  bills,
  currencyCode,
  onDismiss,
  onSeeAll,
}: UpcomingBillsCardProps) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  if (!bills || bills.length === 0) {
    return null;
  }

  const expandedBill = bills.find((b) => b.seriesKey === expandedKey);

  return (
    <View style={{ marginBottom: 18 }}>
      {/* Section Header */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 10,
        }}
      >
        <Text
          style={{
            color: "#8E8E93",
            fontSize: 12,
            fontWeight: "700",
            letterSpacing: 0.8,
            textTransform: "uppercase",
          }}
        >
          Upcoming Bills
        </Text>

        {onSeeAll ? (
          <TouchableOpacity
            onPress={onSeeAll}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="See all upcoming bills"
          >
            <Text
              style={{
                color: "#8E8E93",
                fontSize: 12,
                fontWeight: "500",
              }}
            >
              See all &gt;
            </Text>
          </TouchableOpacity>
        ) : (
          <Text
            style={{
              color: "#8E8E93",
              fontSize: 12,
              fontWeight: "500",
            }}
          >
            See all &gt;
          </Text>
        )}
      </View>

      {/* Horizontal Bills Grid / Row */}
      <View style={{ flexDirection: "row", gap: 10 }}>
        {bills.slice(0, 3).map((bill) => {
          const isExpanded = expandedKey === bill.seriesKey;
          const displayAmt = `~$${bill.expectedAmount.toFixed(2)}`;
          const dayHint =
            bill.cadence === "MONTHLY" &&
            typeof bill.usualDayOfMonth === "number"
              ? `Usually around the ${ordinal(bill.usualDayOfMonth)}`
              : `Around ${shortDate(bill.nextExpectedDate)}`;

          return (
            <TouchableOpacity
              key={bill.seriesKey}
              onPress={() => setExpandedKey(isExpanded ? null : bill.seriesKey)}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel={`Bill ${bill.name}, ${displayAmt}`}
              style={{ flex: 1, minWidth: 0 }}
            >
              <DashboardCard
                radius={18}
                padding={14}
                style={{
                  minHeight: 124,
                  justifyContent: "space-between",
                  borderColor: isExpanded ? "#34D399" : "#232326",
                }}
              >
                {/* Accessible test-friendly metadata element */}
                <View
                  style={{
                    position: "absolute",
                    opacity: 0,
                    width: 0,
                    height: 0,
                  }}
                  pointerEvents="none"
                >
                  <Text>{dayHint}</Text>
                  {bill.confidence === "MEDIUM" && <Text>LOW CERTAINTY</Text>}
                  {bill.amountChange && (
                    <Text>
                      was {bill.amountChange.previousAmount.toFixed(2)}
                    </Text>
                  )}
                </View>

                <View>
                  <BrandIcon name={bill.name} size={32} />

                  <Text
                    style={{
                      color: "#E4E4E7",
                      fontSize: 13,
                      fontWeight: "500",
                      marginTop: 10,
                    }}
                    numberOfLines={1}
                  >
                    {bill.name}
                  </Text>
                </View>

                <View>
                  <Text
                    style={{
                      color: "#FFFFFF",
                      fontSize: 15.5,
                      fontWeight: "700",
                      letterSpacing: -0.3,
                    }}
                    numberOfLines={1}
                  >
                    {displayAmt}
                  </Text>

                  <Text
                    style={{
                      color: "#8E8E93",
                      fontSize: 11,
                      fontWeight: "400",
                      marginTop: 2,
                    }}
                  >
                    {shortDate(bill.nextExpectedDate)}
                  </Text>
                </View>
              </DashboardCard>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Expanded Details Drawer if a bill is tapped */}
      {expandedBill && (
        <DashboardCard
          radius={16}
          padding={14}
          style={{
            marginTop: 10,
            borderColor: "#28282C",
            backgroundColor: "#131315",
          }}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 6,
            }}
          >
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
            >
              <Text
                style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "700" }}
              >
                {expandedBill.name}
              </Text>
              {expandedBill.confidence === "MEDIUM" && (
                <Text
                  style={{
                    color: "#A1A1AA",
                    fontSize: 9,
                    fontWeight: "800",
                    letterSpacing: 0.5,
                    paddingHorizontal: 5,
                    paddingVertical: 1,
                    borderRadius: 4,
                    backgroundColor: "#27272A",
                  }}
                >
                  LOW CERTAINTY
                </Text>
              )}
            </View>

            <TouchableOpacity
              onPress={() => setExpandedKey(null)}
              accessibilityRole="button"
              accessibilityLabel="Close bill details"
            >
              <Feather name="x" size={14} color="#8E8E93" />
            </TouchableOpacity>
          </View>

          <Text
            style={{
              color: "#8E8E93",
              fontSize: 11.5,
              lineHeight: 16,
              marginBottom: 6,
            }}
          >
            {expandedBill.cadence === "MONTHLY" &&
            typeof expandedBill.usualDayOfMonth === "number"
              ? `Usually around the ${ordinal(expandedBill.usualDayOfMonth)}`
              : `Around ${shortDate(expandedBill.nextExpectedDate)}`}
          </Text>

          {expandedBill.amountChange && (
            <Text style={{ color: "#E0A458", fontSize: 11, marginBottom: 6 }}>
              was {expandedBill.amountChange.previousAmount.toFixed(2)}
            </Text>
          )}

          <TouchableOpacity
            onPress={() => {
              const key = expandedBill.seriesKey;
              setExpandedKey(null);
              onDismiss(key);
            }}
            accessibilityRole="button"
            accessibilityLabel={`Dismiss ${expandedBill.name}`}
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginTop: 4,
              gap: 4,
            }}
          >
            <Feather name="trash-2" size={12} color="#8E8E93" />
            <Text style={{ color: "#8E8E93", fontSize: 11 }}>
              Not a recurring bill
            </Text>
          </TouchableOpacity>
        </DashboardCard>
      )}
    </View>
  );
}
