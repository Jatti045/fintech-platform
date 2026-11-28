import React, { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { BRAND, TYPE } from "@/constants/ThemePalettes";
import { useTheme } from "@/hooks/useRedux";
import { hexToRgba, formatCurrency } from "@/utils/helper";
import CashFlowRibbons, { type CashFlowBranch } from "./CashFlowRibbons";

export default function CashFlowPanel({
  income,
  spent,
  remaining,
  currency,
}: {
  income: number;
  spent: number;
  remaining: number;
  currency: string;
}) {
  const { THEME, selectedAccent } = useTheme();
  const spentColor = selectedAccent === "Fern" ? THEME.chart4 : THEME.primary;
  const [selection, setSelection] = useState<{
    branch: CashFlowBranch;
    trace: number;
  }>({
    branch: "left",
    trace: 0,
  });
  const overIncome = remaining < 0;
  const hasSplit = income > 0 && spent >= 0;
  const share = income > 0 ? spent / income : 0;
  const leftLabel = overIncome ? "Over income" : "Income left";
  const choices = [
    {
      branch: "spent",
      label: spent < 0 ? "Net credits" : "Spent",
      value: Math.abs(spent),
      color: spentColor,
    },
    {
      branch: "left",
      label: leftLabel,
      value: remaining,
      color: overIncome ? THEME.danger : THEME.success,
    },
  ] as const;

  const context =
    income <= 0
      ? "No income recorded or planned for this month."
      : spent < 0
        ? "Expense credits exceed spending this month."
        : overIncome
          ? `Spending exceeds income by ${formatCurrency(-remaining, currency)}.`
          : selection.branch === "spent"
            ? `${Math.round(share * 100)}% of monthly income spent`
            : `${Math.round((remaining / income) * 100)}% of monthly income left`;

  return (
    <View
      style={[
        styles.panel,
        { backgroundColor: THEME.surface, borderColor: THEME.border },
      ]}
    >
      {hasSplit && (
        <CashFlowRibbons
          spentColor={spentColor}
          spentShare={Math.min(1, share)}
          selected={selection.branch}
          trace={selection.trace}
        />
      )}
      <View style={styles.choices}>
        {choices.map(({ branch, label, value, color }) => {
          const selected = selection.branch === branch;
          const amount = formatCurrency(value, currency);
          return (
            <TouchableOpacity
              key={branch}
              accessibilityRole="button"
              accessibilityLabel={`${label}, ${amount}`}
              accessibilityState={{ selected }}
              activeOpacity={0.75}
              onPress={() =>
                setSelection((previous) => ({
                  branch,
                  trace: previous.trace + 1,
                }))
              }
              style={[
                styles.choice,
                {
                  backgroundColor: selected
                    ? hexToRgba(color, 0.13)
                    : THEME.surfaceHover,
                  borderColor: selected ? color : THEME.surfaceHover,
                },
              ]}
            >
              <View style={styles.label}>
                <View
                  aria-hidden
                  style={[styles.dot, { backgroundColor: color }]}
                />
                <Text
                  style={[
                    TYPE.caption,
                    { color: THEME.textSecondary, flexShrink: 1 },
                  ]}
                >
                  {label}
                </Text>
              </View>
              <Text style={[TYPE.amount, { color: THEME.textPrimary }]}>
                {amount}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <Text
        accessibilityLiveRegion="polite"
        style={[TYPE.caption, { color: THEME.textSecondary }]}
      >
        {context}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: BRAND.radius.card,
    padding: BRAND.spacing.md,
    gap: BRAND.spacing.sm,
  },
  choices: { flexDirection: "row", flexWrap: "wrap", gap: BRAND.spacing.sm },
  choice: {
    flexBasis: 112,
    flexGrow: 1,
    minHeight: BRAND.touchTarget,
    borderWidth: 1,
    borderRadius: BRAND.radius.input,
    paddingVertical: BRAND.spacing.sm,
    paddingHorizontal: BRAND.spacing.sm + BRAND.spacing.xs,
    gap: BRAND.spacing.xs,
    justifyContent: "center",
  },
  label: { flexDirection: "row", alignItems: "center", gap: BRAND.spacing.xs },
  dot: { width: 7, height: 7, borderRadius: 4 },
});
