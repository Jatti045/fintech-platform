import React, { useMemo } from "react";
import { Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme, useBudgets } from "@/hooks/useRedux";
import { capitalizeFirst, formatCurrency, hexToRgba } from "@/utils/helper";
import { safeAmount } from "@/utils/transaction/helpers";
import type { ITransaction } from "@/types/transaction/types";
import GlassPanel from "@/components/global/GlassPanel";

export interface RecentFlowProps {
  transactions: ITransaction[];
  currencyCode: string;
}

/**
 * RecentFlow — the latest transactions as a compact glass timeline. Helps you
 * see, at a glance, what the money has been doing lately without leaving Home.
 */
const RecentFlow = React.memo(function RecentFlow({
  transactions,
  currencyCode,
}: RecentFlowProps) {
  const { THEME } = useTheme();
  const budgets = useBudgets();

  const budgetMap = useMemo(() => {
    const map = new Map<string, { category: string; icon?: string }>();
    for (const b of budgets) map.set(b.id, { category: b.category, icon: b.icon });
    return map;
  }, [budgets]);

  const recent = useMemo(
    () =>
      [...transactions]
        .sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
        )
        .slice(0, 4),
    [transactions],
  );

  if (recent.length === 0) return null;

  return (
    <GlassPanel padding={14} radius={20} style={{ marginBottom: 14 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          marginBottom: 8,
        }}
      >
        <View
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: THEME.primary,
            marginRight: 8,
          }}
        />
        <Text
          style={{
            color: THEME.textPrimary,
            fontSize: 13,
            fontWeight: "800",
            textTransform: "uppercase",
            letterSpacing: 0.4,
            flex: 1,
          }}
        >
          Recent flow
        </Text>
        <Text style={{ color: THEME.textSecondary, fontSize: 11 }}>
          Latest activity
        </Text>
      </View>

      {recent.map((tx, i) => {
        const meta = tx.budgetId ? budgetMap.get(tx.budgetId) : undefined;
        const category = meta?.category ?? tx.category ?? "Uncategorized";
        const icon = (meta?.icon || tx.icon || "circle") as keyof typeof Feather.glyphMap;
        const amount = safeAmount(tx.displayAmount ?? tx.amount);
        const currency = (tx.displayCurrency || tx.baseCurrency || currencyCode).toUpperCase();
        const isExpense = (tx.type ?? "EXPENSE").toUpperCase() === "EXPENSE";

        return (
          <View
            key={tx.id ?? `${i}`}
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingVertical: 10,
              borderTopWidth: i === 0 ? 0 : 1,
              borderTopColor: hexToRgba(THEME.border, 0.7),
            }}
          >
            <View
              style={{
                width: 34,
                height: 34,
                borderRadius: 11,
                backgroundColor: hexToRgba(
                  isExpense ? THEME.primary : THEME.success,
                  0.14,
                ),
                alignItems: "center",
                justifyContent: "center",
                marginRight: 12,
              }}
            >
              <Feather
                name={icon}
                size={15}
                color={isExpense ? THEME.primary : THEME.success}
              />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                style={{ color: THEME.textPrimary, fontSize: 13, fontWeight: "700" }}
                numberOfLines={1}
              >
                {capitalizeFirst(category)}
              </Text>
              <Text
                style={{ color: THEME.textSecondary, fontSize: 11, marginTop: 1 }}
                numberOfLines={1}
              >
                {tx.name}
              </Text>
            </View>
            <Text
              style={{
                color: isExpense ? THEME.textPrimary : THEME.success,
                fontSize: 13,
                fontWeight: "800",
                marginLeft: 8,
              }}
              numberOfLines={1}
            >
              {isExpense ? "−" : "+"}
              {formatCurrency(amount, currency)}
            </Text>
          </View>
        );
      })}
    </GlassPanel>
  );
});

export default RecentFlow;