import { useMemo } from "react";
import { safeAmount } from "@/utils/transaction/helpers";
import type {
  TransactionItem,
  GroupedSection,
} from "@/types/transaction/types";

type FilterState = {
  filterCategoryId: string;
  minAmount: string;
  maxAmount: string;
};

const UTC_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const UTC_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const UTC_MONTHS_FULL = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function toUtcDateString(dateInput: string | Date): string {
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return "Unknown Date";
  return `${UTC_DAYS[d.getUTCDay()]} ${UTC_MONTHS[d.getUTCMonth()]} ${String(d.getUTCDate()).padStart(2, "0")} ${d.getUTCFullYear()}`;
}

export function toUtcMonthString(dateInput: string | Date): string {
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return "Unknown Date";
  return `${UTC_MONTHS_FULL[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/**
 * Derives the filtered + grouped transaction data that feeds into the
 * SectionList on the Transactions screen.
 *
 * Filter state is owned by the caller (`useTransactionScreen`) so the same
 * values can be passed to the server-side query before this hook runs;
 * client-side filtering here remains as a display-level refinement.
 */
export function useTransactionFilters(
  transactions: any[],
  budgets: any[],
  { filterCategoryId, minAmount, maxAmount }: FilterState,
) {
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
      // Category / Type filter
      if (filterCategoryId !== "all") {
        if (filterCategoryId === "income") {
          const type = (t.type ?? "").toUpperCase();
          if (type !== "INCOME") return false;
        } else if (filterCategoryId === "transfer_out") {
          const cat = String(t.category || "").toLowerCase();
          const name = String(t.name || "").toLowerCase();
          if (
            !t.isTransfer &&
            !cat.includes("transfer out") &&
            !name.includes("transfer out")
          ) {
            return false;
          }
        } else if (filterCategoryId === "transfer_in") {
          const cat = String(t.category || "").toLowerCase();
          const name = String(t.name || "").toLowerCase();
          if (
            !t.isTransfer &&
            !cat.includes("transfer in") &&
            !name.includes("transfer in")
          ) {
            return false;
          }
        } else {
          const txBudgetId = t.budgetId ?? t.budget?.id;
          if (txBudgetId) {
            if (txBudgetId !== filterCategoryId) return false;
          } else {
            const filterCat = budgetCategoryMap.get(filterCategoryId) ?? "";
            if (String(t.category).toLowerCase() !== filterCat) return false;
          }
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
   * Grouped-by-month sections sorted newest-first with integer-cent totals.
   * Groups items into cohesive monthly card sections matching the reference design.
   */
  const sectionsWithTotals = useMemo<GroupedSection[]>(() => {
    const groups: Record<string, TransactionItem[]> = {};

    for (const t of filteredTransactions) {
      const monthKey = toUtcMonthString(t.date);
      (groups[monthKey] ??= []).push(t as TransactionItem);
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
            // Section total reflects spending only (income shows in rows but
            // doesn't inflate the "spent" figure).
            total:
              Math.round(
                data
                  .filter(
                    (tx) =>
                      !tx.isTransfer &&
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
        // Sort sections: newest month first
        .sort((a, b) => {
          const dateA = new Date(a.data[0]?.date || a.title).getTime();
          const dateB = new Date(b.data[0]?.date || b.title).getTime();
          return dateB - dateA;
        })
    );
  }, [filteredTransactions]);

  return {
    // Derived data
    filteredTransactions,
    sectionsWithTotals,
  };
}
