import { isDarkPalette } from "@/constants/ThemePalettes";
import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  useWindowDimensions,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import Svg, { Path } from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";
import MonthlyDetails from "./MonthlyDetails";
import { formatCurrency, hexToRgba } from "@/utils/helper";
import { useTheme } from "@/hooks/useRedux";
import type { IFinancialReport } from "@/types/financialSummary/types";
import DashboardCard from "./DashboardCard";

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

export default function MonthlyOverview({
  monthlyIncome,
  totalSpent,
  currencyCode,
  monthLabel,
  isCurrentMonth,
  daily,
  month,
  year,
  report,
}: MonthlyOverviewProps) {
  const [expanded, setExpanded] = useState(false);
  const { width, fontScale } = useWindowDimensions();
  const stackMetrics = width < 400 || fontScale > 1.15;
  const income = Math.max(0, monthlyIncome || 0);
  const net = report?.summary.netRemaining ?? income - totalSpent;
  const { THEME } = useTheme();
  return (
    <DashboardCard style={{ marginBottom: 14 }}>
      <View style={{ borderRadius: 18, overflow: "hidden" }}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Monthly details"
          accessibilityHint="Show income basis, spending trend and monthly comparisons"
          accessibilityValue={{
            text: `${formatCurrency(net, currencyCode)} income remaining, ${formatCurrency(income, currencyCode)} income, ${formatCurrency(totalSpent, currencyCode)} expenses`,
          }}
          accessibilityState={{ expanded }}
          onPress={() => setExpanded(!expanded)}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={[THEME.surface, THEME.subtleSurface]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ padding: 18, paddingBottom: 22, overflow: "hidden" }}
          >
            <View
              pointerEvents="none"
              accessible={false}
              style={{
                position: "absolute",
                right: -12,
                bottom: -32,
                width: 185,
                height: 155,
              }}
            >
              <Svg width="100%" height="100%" viewBox="0 0 185 155">
                <Path
                  d="M78 155C60 55 111 4 185 0C193 83 153 139 78 155Z"
                  fill={isDarkPalette(THEME) ? THEME.textSecondary : THEME.primary}
                  opacity={0.19}
                />
                <Path
                  d="M58 155C64 99 117 60 185 53C178 109 131 150 58 155Z"
                  fill={isDarkPalette(THEME) ? THEME.textSecondary : THEME.primary}
                  opacity={0.15}
                />
                <Path
                  d="M0 155C-9 99 12 58 47 50C90 40 117 86 105 155Z"
                  fill={isDarkPalette(THEME) ? THEME.textSecondary : THEME.primary}
                  opacity={0.06}
                />
              </Svg>
            </View>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Text
                accessibilityRole="header"
                style={{
                  color: THEME.textSecondary,
                  fontSize: 14,
                  fontWeight: "600",
                }}
              >
                {net < 0 ? "Spending over income" : "Income remaining"}
              </Text>
              <Feather
                name={expanded ? "chevron-up" : "chevron-down"}
                size={16}
                color={THEME.primary}
              />
            </View>
            <Text
              accessibilityLabel={`${formatCurrency(net, currencyCode)} ${net < 0 ? "over income" : "income remaining"}`}
              adjustsFontSizeToFit
              numberOfLines={1}
              style={{
                color: net < 0 ? THEME.danger : THEME.textPrimary,
                fontSize: 36,
                fontWeight: "800",
                letterSpacing: -1.3,
                fontVariant: ["tabular-nums"],
                marginTop: 4,
              }}
            >
              {formatCurrency(net, currencyCode)}
            </Text>
          </LinearGradient>
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              padding: 16,
              gap: 12,
              backgroundColor: THEME.surface,
              borderTopLeftRadius: 22,
              borderTopRightRadius: 22,
              marginTop: -8,
            }}
          >
            {[
              {
                label: "Income",
                amount: income,
                icon: "arrow-up" as const,
                color: THEME.primary,
                background: THEME.subtleSurface,
              },
              {
                label: "Expenses",
                amount: totalSpent,
                icon: "arrow-down" as const,
                color: THEME.danger,
                background: THEME.errorSurface,
              },
            ].map((item, index) => (
              <View
                key={item.label}
                style={{
                  flex: 1,
                  minWidth: 120,
                  flexDirection: stackMetrics ? "column" : "row",
                  alignItems: stackMetrics ? "flex-start" : "center",
                  gap: 10,
                  borderLeftWidth: index ? 1 : 0,
                  borderLeftColor: hexToRgba(THEME.border, 0.55),
                  paddingLeft: index ? 12 : 0,
                }}
              >
                <View
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 17,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: item.background,
                  }}
                >
                  <Feather name={item.icon} size={21} color={item.color} />
                </View>
                <View
                  style={{
                    alignSelf: "stretch",
                    flex: stackMetrics ? undefined : 1,
                  }}
                >
                  <Text style={{ color: THEME.textSecondary, fontSize: 12 }}>
                    {item.label}
                  </Text>
                  <Text
                    adjustsFontSizeToFit
                    numberOfLines={1}
                    style={{
                      color: THEME.textPrimary,
                      fontSize: stackMetrics ? 18 : 19,
                      fontWeight: "700",
                      fontVariant: ["tabular-nums"],
                      marginTop: 3,
                    }}
                  >
                    {formatCurrency(item.amount, currencyCode)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </TouchableOpacity>
        {expanded && (
          <MonthlyDetails
            monthlyIncome={monthlyIncome}
            totalSpent={totalSpent}
            currencyCode={currencyCode}
            daily={daily}
            month={month}
            year={year}
            report={report}
            monthLabel={monthLabel}
            isCurrentMonth={isCurrentMonth}
          />
        )}
      </View>
    </DashboardCard>
  );
}
