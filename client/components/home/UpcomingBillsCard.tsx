import React, { useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useRedux";
import SectionHeader from "@/components/global/SectionHeader";
import GlassPanel from "@/components/global/GlassPanel";
import { hexToRgba } from "@/utils/helper";
import type { IRecurringPayment } from "@/types/recurring/types";

export interface UpcomingBillsCardProps {
  /** Predicted bills due soonest first (dismissed rows already removed). */
  bills: IRecurringPayment[];
  currencyCode: string;
  /** Persists a dismissal so the series stops appearing on this device. */
  onDismiss: (seriesKey: string) => void;
}

/** 1 → 1st, 2 → 2nd, 13 → 13th … */
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
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const CADENCE_LABEL: Record<string, string> = {
  WEEKLY: "Every week",
  BIWEEKLY: "Every two weeks",
  MONTHLY: "Monthly",
  QUARTERLY: "Roughly every three months",
};

/**
 * Upcoming Bills card for the Home screen.
 *
 * Presents recurring-payment predictions with deliberately hedged wording
 * ("usually", "~") — these are estimates derived from history, never
 * guarantees. Tapping a row expands the evidence behind the prediction plus a
 * dismiss control, so a false positive costs one tap, not trust.
 */
export default function UpcomingBillsCard({
  bills,
  currencyCode,
  onDismiss,
}: UpcomingBillsCardProps) {
  const { THEME } = useTheme();
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  if (bills.length === 0) {
    // No confident predictions — the quietest treatment is no card at all.
    return null;
  }

  const upcomingCount = bills.filter(
    (b) => (new Date(b.nextExpectedDate).getTime() - Date.now()) / 86_400_000 <= 7,
  ).length;

  return (
    <View style={{ marginBottom: 16 }}>
      <SectionHeader
        title="Upcoming Bills"
        subtitle={
          upcomingCount > 0
            ? `Likely in the next 7 days (${upcomingCount})`
            : "Based on your history"
        }
        accent={THEME.primary}
      />
      <GlassPanel padding={12} radius={18} style={{ marginBottom: 12 }}>
        {bills.map((bill, index) => (
          <BillRow
            key={bill.seriesKey}
            bill={bill}
            isFirst={index === 0}
            expanded={expandedKey === bill.seriesKey}
            currencyCode={currencyCode}
            onToggle={() =>
              setExpandedKey(expandedKey === bill.seriesKey ? null : bill.seriesKey)
            }
            onDismiss={() => {
              setExpandedKey(null);
              onDismiss(bill.seriesKey);
            }}
          />
        ))}
      </GlassPanel>
    </View>
  );
}

function BillRow({
  bill,
  isFirst,
  expanded,
  currencyCode,
  onToggle,
  onDismiss,
}: {
  bill: IRecurringPayment;
  isFirst: boolean;
  expanded: boolean;
  currencyCode: string;
  onToggle: () => void;
  onDismiss: () => void;
}) {
  const { THEME } = useTheme();

  const dayHint =
    bill.cadence === "MONTHLY" && typeof bill.usualDayOfMonth === "number"
      ? `Usually around the ${ordinal(bill.usualDayOfMonth)}`
      : CADENCE_LABEL[bill.cadence]
        ? `${CADENCE_LABEL[bill.cadence]} · around ${shortDate(bill.nextExpectedDate)}`
        : `Around ${shortDate(bill.nextExpectedDate)}`;

  return (
    <View
      style={{
        borderTopWidth: isFirst ? 0 : 1,
        borderTopColor: hexToRgba(THEME.border, 0.6),
      }}
    >
      <TouchableOpacity
        onPress={onToggle}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={`Upcoming bill ${bill.name}, about ${bill.expectedAmount}`}
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingVertical: 10,
          gap: 10,
        }}
      >
        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: 11,
            backgroundColor: hexToRgba(THEME.primary, 0.12),
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Feather name="calendar" size={15} color={THEME.primary} />
        </View>

        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text
              numberOfLines={1}
              style={{
                color: THEME.textPrimary,
                fontSize: 14,
                fontWeight: "700",
                flexShrink: 1,
              }}
            >
              {bill.name}
            </Text>
            {bill.confidence === "MEDIUM" && (
              <Text
                style={{
                  color: THEME.textSecondary,
                  fontSize: 9,
                  fontWeight: "800",
                  letterSpacing: 0.5,
                  paddingHorizontal: 5,
                  paddingVertical: 1,
                  borderRadius: 6,
                  backgroundColor: hexToRgba(THEME.textSecondary, 0.12),
                }}
              >
                LOW CERTAINTY
              </Text>
            )}
          </View>
          <Text
            style={{ color: THEME.textSecondary, fontSize: 11, marginTop: 1 }}
            numberOfLines={1}
          >
            {dayHint}
          </Text>
        </View>

        <View style={{ alignItems: "flex-end" }}>
          <Text style={{ color: THEME.textPrimary, fontSize: 14, fontWeight: "700" }}>
            ~${bill.expectedAmount.toFixed(2)}
            {currencyCode !== "USD" ? ` ${currencyCode}` : ""}
          </Text>
          {bill.amountChange && (
            <Text style={{ color: THEME.warning, fontSize: 10 }}>
              was {bill.amountChange.previousAmount.toFixed(2)}
            </Text>
          )}
        </View>

        <Feather
          name={expanded ? "chevron-up" : "chevron-down"}
          size={16}
          color={THEME.textSecondary}
        />
      </TouchableOpacity>

      {expanded && (
        <View style={{ paddingBottom: 12, paddingHorizontal: 4, gap: 6 }}>
          <Text style={{ color: THEME.textSecondary, fontSize: 11, lineHeight: 16 }}>
            Based on {bill.occurrences} similar charges,{" "}
            {(CADENCE_LABEL[bill.cadence] ?? `about every ${bill.intervalDays} days`).toLowerCase()}
            . This is an estimate, not a scheduled payment.
          </Text>

          {bill.matchedTransactions.slice(0, 4).map((match) => (
            <View
              key={match.id}
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                backgroundColor: hexToRgba(THEME.border, 0.25),
                borderRadius: 8,
                paddingHorizontal: 10,
                paddingVertical: 6,
              }}
            >
              <Text style={{ color: THEME.textSecondary, fontSize: 11 }}>
                {shortDate(match.date)}
              </Text>
              <Text style={{ color: THEME.textPrimary, fontSize: 11, fontWeight: "600" }}>
                {match.amount.toFixed(2)}
              </Text>
            </View>
          ))}

          <TouchableOpacity
            onPress={onDismiss}
            accessibilityRole="button"
            accessibilityLabel={`Dismiss ${bill.name}`}
            style={{
              alignSelf: "flex-start",
              marginTop: 2,
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
            }}
          >
            <Feather name="x" size={12} color={THEME.textSecondary} />
            <Text style={{ color: THEME.textSecondary, fontSize: 11 }}>
              Not a recurring bill
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
