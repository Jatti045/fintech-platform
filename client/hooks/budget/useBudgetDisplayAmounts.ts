import { useEffect, useMemo, useState } from "react";
import { convertCurrency } from "@/utils/currencyConverter";
import type { DisplayBudget, IBudget } from "@/types/budget/types";
import type { ITransaction } from "@/types/transaction/types";

export type { DisplayBudget };

const normalizeCurrency = (value?: string | null) =>
  String(value || "")
    .trim()
    .toUpperCase();

const pickMostFrequentCurrency = (items: string[]) => {
  const counts = new Map<string, number>();
  for (const c of items) {
    if (!c) continue;
    counts.set(c, (counts.get(c) || 0) + 1);
  }

  let best = "";
  let max = 0;
  for (const [currency, count] of counts.entries()) {
    if (count > max) {
      max = count;
      best = currency;
    }
  }

  return best;
};

/**
 * Returns budget amounts converted for display in the active/default currency.
 *
 * Important:
 * - `limit` is treated as canonical (already authored in the user's default
 *   currency at create/update time), so it is NOT re-converted here.
 * - `spent` is derived from historical transactions and may need conversion
 *   for display when old records were created under another default currency.
 */
export function useBudgetDisplayAmounts(
  budgets: IBudget[],
  transactions: ITransaction[],
  activeCurrency: string,
) {
  const [displayBudgets, setDisplayBudgets] = useState<DisplayBudget[]>(() =>
    budgets.map((b) => ({
      ...b,
      displayLimit: Number(b.limit || 0),
      displaySpent: Number(b.spent || 0),
      displayCurrency: normalizeCurrency(activeCurrency) || "USD",
    })),
  );

  const normalizedActiveCurrency = useMemo(
    () => normalizeCurrency(activeCurrency) || "USD",
    [activeCurrency],
  );

  const globalSourceCurrency = useMemo(() => {
    const txCurrencies = transactions
      .filter(
        (t) =>
          !t.isTransfer &&
          String(t.type ?? "EXPENSE").toUpperCase() === "EXPENSE",
      )
      .map((t) => normalizeCurrency(t.baseCurrency || t.originalCurrency));

    return pickMostFrequentCurrency(txCurrencies) || normalizedActiveCurrency;
  }, [transactions, normalizedActiveCurrency]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const byBudgetId = new Map<string, string[]>();
      const byCategory = new Map<string, string[]>();

      for (const tx of transactions) {
        if (String(tx.type ?? "EXPENSE").toUpperCase() !== "EXPENSE") continue;
        // Transfers between the user's own accounts are not spending.
        if (tx.isTransfer) continue;
        const txCurrency = normalizeCurrency(
          tx.baseCurrency || tx.originalCurrency,
        );
        if (!txCurrency) continue;

        if (tx.budgetId) {
          const arr = byBudgetId.get(tx.budgetId) || [];
          arr.push(txCurrency);
          byBudgetId.set(tx.budgetId, arr);
        }

        const cat = String(tx.category || "")
          .trim()
          .toLowerCase();
        if (cat) {
          const arr = byCategory.get(cat) || [];
          arr.push(txCurrency);
          byCategory.set(cat, arr);
        }
      }

      const mapped = await Promise.all(
        budgets.map(async (budget) => {
          const budgetCurrencies =
            byBudgetId.get(budget.id) ||
            byCategory.get(
              String(budget.category || "")
                .trim()
                .toLowerCase(),
            ) ||
            [];

          const sourceCurrency =
            pickMostFrequentCurrency(budgetCurrencies) || globalSourceCurrency;

          const rawLimit = Number(budget.limit || 0);
          const rawSpent = Number(budget.spent || 0);

          // Limit is canonical in active/default currency; do not convert.
          const displayLimit = rawLimit;
          let displaySpent = rawSpent;

          if (sourceCurrency && sourceCurrency !== normalizedActiveCurrency) {
            try {
              const convertedSpent = await convertCurrency(
                rawSpent,
                sourceCurrency,
                normalizedActiveCurrency,
              );
              displaySpent = Number(convertedSpent || 0);
            } catch {
              // Keep persisted values as a fallback.
            }
          }

          return {
            ...budget,
            displayLimit,
            displaySpent,
            displayCurrency: normalizedActiveCurrency,
          };
        }),
      );

      if (!cancelled) {
        setDisplayBudgets(mapped);
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [budgets, transactions, normalizedActiveCurrency, globalSourceCurrency]);

  return { displayBudgets };
}
