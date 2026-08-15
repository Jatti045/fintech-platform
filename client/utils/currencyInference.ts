import type { ITransaction } from "@/types/transaction/types";

/** Upper-cases and trims a currency code for consistent comparison. */
export const normalizeCurrency = (value?: string | null): string =>
  String(value || "")
    .trim()
    .toUpperCase();

/**
 * Infers the dominant source currency among a month's expense transactions.
 *
 * Algorithm (preserved from the homepage):
 *  1. Only expense transactions count.
 *  2. Prefer `baseCurrency`, otherwise `originalCurrency`.
 *  3. Normalize currency codes (trim + upper-case).
 *  4. Count occurrences and pick the most common.
 *  5. Fall back to the user's currency, then `"USD"`.
 *
 * Pure and side-effect free so it can be unit-tested independently.
 */
export function inferExpenseSourceCurrency(
  transactions: ITransaction[],
  fallbackCurrency?: string | null,
): string {
  const counts = new Map<string, number>();

  for (const tx of transactions) {
    if (String(tx.type ?? "EXPENSE").toUpperCase() !== "EXPENSE") continue;
    const currency = normalizeCurrency(tx.baseCurrency || tx.originalCurrency);
    if (!currency) continue;
    counts.set(currency, (counts.get(currency) || 0) + 1);
  }

  let winner = "";
  let max = 0;
  for (const [currency, count] of counts.entries()) {
    if (count > max) {
      max = count;
      winner = currency;
    }
  }

  return winner || normalizeCurrency(fallbackCurrency) || "USD";
}
