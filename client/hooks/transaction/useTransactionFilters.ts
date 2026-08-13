import { useCallback, useMemo, useState } from "react";
import { safeAmount } from "@/utils/transaction/helpers";
import type {
  TransactionItem,
  GroupedSection,
} from "@/types/transaction/types";

/**
 * Encapsulates all filter state and the derived filtered + grouped transaction
 * data that feeds into the SectionList on the Transactions screen.
 */
export function useTransactionFilters(transactions: any[], budgets: any[]) {
  // ── Filter controls ───────────────────────────────────────────────────
  const [filterCategoryId, setFilterCategoryId] = useState<string | "all">(
    "all",
  );
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");

  /** Reset all filter controls to their default values. */
  const clearFilters = useCallback(() => {
    setFilterCategoryId("all");
    setMinAmount("");
    setMaxAmount("");
  }, []);

  // ── Derived / memoised data ───────────────────────────────────────────

  /**
   * Budget-id → category-name lookup map.
   * Eliminates the O(n) `budgets.find()` that was previously executed
   * per transaction inside the filter callback.
   */
  const budgetCategoryMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const b of budgets) {
      map.set(b.id, (b.category ?? "").toLowerCase());
    }
    return map;
  }, [budgets]);

  /**
   * Transactions filtered by category, amount range, and search query.
   * Both INCOME and EXPENSE transactions are shown so money coming in is
   * visible alongside spending.
   */
  const filteredTransactions = useMemo(() => {
    const minParsed = minAmount.trim() !== "" ? Number(minAmount) || 0 : null;
    const maxParsed = maxAmount.trim() !== "" ? Number(maxAmount) || 0 : null;

    return transactions.filter((t: any) => {
      // Category filter — O(1) map lookup instead of O(n) find
      if (filterCategoryId !== "all") {
        if (t.budgetId) {
          if (t.budgetId !== filterCategoryId) return false;
        } else {
          const filterCat = budgetCategoryMap.get(filterCategoryId) ?? "";
          if (String(t.category).toLowerCase() !== filterCat) return false;
        }
      }

      // Amount range
      const amt = safeAmount(t.displayAmount ?? t.amount);
      if (minParsed !== null && amt < minParsed) return false;
      if (maxParsed !== null && amt > maxParsed) return false;

      return true;
    });
  }, [transactions, filterCategoryId, budgetCategoryMap, minAmount, maxAmount]);

  /**
   * Grouped-by-day sections sorted newest-first with integer-cent totals.
   *
   * A single `useMemo` pass replaces the previous 3-step chain:
   *   reduce → sort(sections) + sort(items) → map(totals)
   * This avoids intermediate allocations and duplicate memoisation boundaries.
   */
  const sectionsWithTotals = useMemo<GroupedSection[]>(() => {
    const groups: Record<string, TransactionItem[]> = {};

    for (const t of filteredTransactions) {
      const dayKey = new Date(t.date).toDateString();
      (groups[dayKey] ??= []).push(t as TransactionItem);
    }

    return (
      Object.entries(groups)
        .map(([title, data]) => {
          // Sort items within the section: newest first
          data.sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
          );
          return {
            title,
            data,
            // Day-total reflects spending only (income shows in the rows but
            // shouldn't inflate the "spent that day" figure).
            total:
              Math.round(
                data
                  .filter(
                    (tx) =>
                      (tx.type ?? "EXPENSE").toUpperCase() === "EXPENSE",
                  )
                  .reduce(
                    (sum, tx) =>
                      sum + safeAmount(tx.displayAmount ?? tx.amount),
                    0,
                  ) * 100,
              ) / 100,
          };
        })
        // Sort sections: newest day first
        .sort(
          (a, b) => new Date(b.title).getTime() - new Date(a.title).getTime(),
        )
    );
  }, [filteredTransactions]);

  return {
    // Filter state
    filterCategoryId,
    setFilterCategoryId,
    minAmount,
    setMinAmount,
    maxAmount,
    setMaxAmount,
    clearFilters,
    // Derived data
    filteredTransactions,
    sectionsWithTotals,
  };
}
