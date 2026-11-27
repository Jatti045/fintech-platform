import React, { useState } from "react";
import { TouchableOpacity, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { BRAND, TYPE } from "@/constants/ThemePalettes";
import { formatCurrency } from "@/utils/helper";
import { useTheme } from "@/hooks/useRedux";
import type { IFinancialReport } from "@/types/financialSummary/types";
import MonthlyDetails from "./MonthlyDetails";
import MonthlySpendingChart from "./MonthlySpendingChart";

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
  const { monthlyIncome, totalSpent, currencyCode, daily, monthLabel } = props;
  const [expanded, setExpanded] = useState(false);
  const { THEME } = useTheme();
  const income = Math.max(0, monthlyIncome || 0);
  const net = props.report?.summary.netRemaining ?? income - totalSpent;
  const label = net < 0 ? "Spending over income" : "Income remaining";
  const amount = formatCurrency(net, currencyCode);

  return (
    <View style={styles.section}>
      <View style={[styles.statement, { backgroundColor: THEME.statement }]}>
        <View style={styles.heading}>
          <Text
            accessibilityRole="header"
            style={[
              TYPE.label,
              styles.headingLabel,
              { color: THEME.statementMuted },
            ]}
          >
            {label}
          </Text>
          <Text style={[TYPE.caption, { color: THEME.statementMuted }]}>
            {currencyCode}
          </Text>
        </View>
        <Text
          accessibilityLabel={`${amount} ${net < 0 ? "over income" : "income remaining"}`}
          style={[
            TYPE.total,
            { color: net < 0 ? THEME.statementDanger : THEME.statementText },
          ]}
        >
          {amount}
        </Text>
        <MonthlySpendingChart
          daily={daily}
          monthLabel={monthLabel}
          currencyCode={currencyCode}
        />
        <View style={[styles.figures, { borderColor: THEME.statementRule }]}>
          {[
            { label: "Income", amount: income },
            { label: "Expenses", amount: totalSpent },
          ].map((item) => (
            <View key={item.label} style={styles.figure}>
              <Text style={[TYPE.caption, { color: THEME.statementMuted }]}>
                {item.label}
              </Text>
              <Text style={[TYPE.amount, { color: THEME.statementText }]}>
                {formatCurrency(item.amount, currencyCode)}
              </Text>
            </View>
          ))}
        </View>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Monthly details"
          accessibilityState={{ expanded }}
          onPress={() => setExpanded((open) => !open)}
          activeOpacity={0.75}
          style={[styles.details, { borderColor: THEME.statementRule }]}
        >
          <Text style={[TYPE.label, { color: THEME.statementAccent }]}>
            Monthly details
          </Text>
          <Feather
            name={expanded ? "chevron-up" : "chevron-down"}
            size={18}
            color={THEME.statementAccent}
          />
        </TouchableOpacity>
      </View>
      {expanded && <MonthlyDetails {...props} />}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: BRAND.spacing.lg },
  statement: {
    borderRadius: BRAND.radius.card,
    paddingHorizontal: BRAND.spacing.md,
    paddingTop: BRAND.spacing.md,
    gap: BRAND.spacing.xs,
  },
  heading: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: BRAND.spacing.xs,
  },
  headingLabel: { flexShrink: 1 },
  figures: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: BRAND.spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: BRAND.spacing.sm,
  },
  figure: { flexGrow: 1, flexBasis: 105, gap: BRAND.spacing.xs },
  details: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: BRAND.touchTarget,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: BRAND.spacing.sm,
  },
});
