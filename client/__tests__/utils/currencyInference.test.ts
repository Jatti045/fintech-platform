/**
 * Currency inference utility tests.
 *
 * Verifies the pure algorithm used by the homepage to infer the source
 * currency of the expense total: expense-only filtering, base-currency
 * preference, normalization, most-common selection, and fallbacks.
 */

import {
  inferExpenseSourceCurrency,
  normalizeCurrency,
} from "@/utils/currencyInference";
import { TransactionType } from "@/types/transaction/types";

const makeTx = (overrides: Record<string, unknown> = {}) => ({
  name: "Coffee",
  month: 1,
  year: 2026,
  category: "Food",
  amount: 10,
  date: "2026-02-01T00:00:00.000Z",
  type: TransactionType.EXPENSE,
  ...overrides,
});

describe("normalizeCurrency", () => {
  it("trims and upper-cases a currency code", () => {
    expect(normalizeCurrency("  usd ")).toBe("USD");
    expect(normalizeCurrency("eur")).toBe("EUR");
  });

  it("returns an empty string for falsy input", () => {
    expect(normalizeCurrency(null)).toBe("");
    expect(normalizeCurrency(undefined)).toBe("");
    expect(normalizeCurrency("")).toBe("");
  });
});

describe("inferExpenseSourceCurrency", () => {
  it("only counts expense transactions", () => {
    const transactions = [
      makeTx({ baseCurrency: "EUR" }),
      makeTx({ baseCurrency: "USD", type: TransactionType.INCOME }),
    ];
    expect(inferExpenseSourceCurrency(transactions)).toBe("EUR");
  });

  it("prefers baseCurrency over originalCurrency", () => {
    const transactions = [
      makeTx({ baseCurrency: "USD", originalCurrency: "EUR" }),
    ];
    expect(inferExpenseSourceCurrency(transactions)).toBe("USD");
  });

  it("falls back to originalCurrency when baseCurrency is missing", () => {
    const transactions = [
      makeTx({ baseCurrency: null, originalCurrency: "EUR" }),
    ];
    expect(inferExpenseSourceCurrency(transactions)).toBe("EUR");
  });

  it("normalizes case before counting", () => {
    const transactions = [makeTx({ baseCurrency: "eur" })];
    expect(inferExpenseSourceCurrency(transactions)).toBe("EUR");
  });

  it("picks the most common currency", () => {
    const transactions = [
      makeTx({ baseCurrency: "USD" }),
      makeTx({ baseCurrency: "USD" }),
      makeTx({ baseCurrency: "EUR" }),
    ];
    expect(inferExpenseSourceCurrency(transactions)).toBe("USD");
  });

  it("falls back to the user currency when no expense currency is found", () => {
    expect(inferExpenseSourceCurrency([], "cad")).toBe("CAD");
  });

  it("falls back to USD when nothing is found", () => {
    expect(inferExpenseSourceCurrency([])).toBe("USD");
    expect(inferExpenseSourceCurrency([makeTx({})], null)).toBe("USD");
  });

  it("ignores transactions with no currency at all", () => {
    const transactions = [
      makeTx({ baseCurrency: null, originalCurrency: null }),
      makeTx({ baseCurrency: "GBP" }),
    ];
    expect(inferExpenseSourceCurrency(transactions)).toBe("GBP");
  });

  it("ignores transfers even when expense-typed", () => {
    const transactions = [
      makeTx({ baseCurrency: "CAD", isTransfer: true }),
      makeTx({ baseCurrency: "EUR" }),
    ];
    expect(inferExpenseSourceCurrency(transactions)).toBe("EUR");
  });
});
