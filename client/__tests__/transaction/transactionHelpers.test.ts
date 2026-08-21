/**
 * Pure-helper tests for the transaction utilities.
 *
 * Covers the transfer-exclusion rule: transactions between the user's own
 * accounts must not inflate daily spending charts.
 */

/// <reference types="jest" />

import { buildDailySpendTotals } from "@/utils/transaction/helpers";

describe("buildDailySpendTotals", () => {
  const month = 7; // August (0-based)
  const year = 2026;

  it("excludes internal transfers from daily spend totals", () => {
    const transactions = [
      { date: "2026-08-05T10:00:00Z", amount: 100, type: "EXPENSE", isTransfer: false },
      { date: "2026-08-05T11:00:00Z", amount: 2000, type: "EXPENSE", isTransfer: true },
    ];

    const series = buildDailySpendTotals(transactions, month, year);

    // August 5 → index 4: only the $100 purchase counts.
    expect(series[4].total).toBe(100);
  });

  it("counts only non-transfer expense transactions", () => {
    const transactions = [
      { date: "2026-08-06T10:00:00Z", amount: 50, type: "EXPENSE" },
      { date: "2026-08-06T11:00:00Z", amount: 3000, type: "INCOME" },
      { date: "2026-08-06T12:00:00Z", amount: 2000, type: "INCOME", isTransfer: true },
    ];

    const series = buildDailySpendTotals(transactions, month, year);

    expect(series[5].total).toBe(50);
  });
});
