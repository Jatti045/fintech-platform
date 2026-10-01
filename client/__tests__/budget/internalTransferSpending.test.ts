import { buildMonthSpendSeries } from "@/utils/budget/budgetCalculations";

describe("budget spending eligibility", () => {
  const transactions = [
    { date: "2026-03-15T00:00:00Z", amount: 25, type: "EXPENSE", category: "Transfer", budgetId: "b" },
    { date: "2026-03-15T00:00:00Z", amount: 500, type: "EXPENSE", isTransfer: true, category: "Transfer", budgetId: "b" },
    { date: "2026-03-15T00:00:00Z", amount: 500, type: "INCOME", isTransfer: true, category: "Transfer" },
    { date: "2026-03-15T00:00:00Z", amount: 1000, type: "INCOME", category: "Transfer", budgetId: "b" },
  ];
  it.each([{ category: "Transfer" }, { budgetId: "b" }])("excludes transfers and income with %p", (filter) => {
    const series = buildMonthSpendSeries(transactions, { ...filter, month: 2, year: 2026 });
    expect(series[14].cumulative).toBe(25);
    expect(series[30].cumulative).toBe(25);
    expect(transactions).toHaveLength(4); // the input ledger remains intact
  });
});
