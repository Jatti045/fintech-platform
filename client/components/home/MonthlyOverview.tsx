import DisclosureChevron from "@/components/global/DisclosureChevron";
import React, { useState } from "react";
import { TouchableOpacity, StyleSheet, Text, View } from "react-native";
import { BRAND, TYPE } from "@/constants/ThemePalettes";
import { formatCurrency } from "@/utils/helper";
import { useTheme } from "@/hooks/useRedux";
import type { IFinancialReport } from "@/types/financialSummary/types";
import CashFlowPanel from "./CashFlowPanel";
import MonthlyDetails from "./MonthlyDetails";

export interface MonthlyOverviewProps {
  monthlyIncome: number;
  totalSpent: number;
  monthLabel: string;
  currencyCode: string;
  isCurrentMonth: boolean;
  daily?: { day: number; netSpent: number }[];
  month?: number;
  year?: number;
  report?: IFinancialReport;
}

export default function MonthlyOverview(props: MonthlyOverviewProps) {
  const { monthlyIncome, totalSpent, currencyCode, report, month, year } =
    props;
  const [expanded, setExpanded] = useState(false);
  const { THEME } = useTheme();
  const income = Math.max(0, monthlyIncome || 0);
  const remaining = report?.summary.netRemaining ?? income - totalSpent;
  const incomeLabel =
    report?.incomeBasis === "EXPECTED"
      ? "Expected income"
      : "Income this month";

  return (
    <View style={styles.section}>
      <View style={styles.income}>
        <View style={styles.heading}>
          <Text
            accessibilityRole="header"
            style={[TYPE.label, { color: THEME.textSecondary }]}
          >
            {incomeLabel}
          </Text>
          <Text style={[TYPE.caption, { color: THEME.textSecondary }]}>
            {currencyCode}
          </Text>
        </View>
        <Text style={[TYPE.total, { color: THEME.textPrimary }]}>
          {formatCurrency(income, currencyCode)}
        </Text>
      </View>
      <CashFlowPanel
        key={`${year}-${month}-${currencyCode}`}
        income={income}
        spent={totalSpent}
        remaining={remaining}
        currency={currencyCode}
      />
      <View style={[styles.details, { borderColor: THEME.border }]}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Monthly details"
          accessibilityState={{ expanded }}
          onPress={() => setExpanded((open) => !open)}
          activeOpacity={0.75}
          style={styles.disclosure}
        >
          <Text style={[TYPE.label, { color: THEME.textPrimary }]}>
            Monthly details
          </Text>
          <DisclosureChevron expanded={expanded} color={THEME.primary} />
        </TouchableOpacity>
        {expanded && <MonthlyDetails {...props} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: BRAND.spacing.lg, gap: BRAND.spacing.sm },
  income: {
    paddingHorizontal: BRAND.spacing.xs,
    paddingBottom: BRAND.spacing.xs,
  },
  heading: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: BRAND.spacing.sm,
  },
  details: { borderBottomWidth: StyleSheet.hairlineWidth },
  disclosure: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: BRAND.touchTarget,
    paddingHorizontal: BRAND.spacing.xs,
    gap: BRAND.spacing.sm,
  },
});
