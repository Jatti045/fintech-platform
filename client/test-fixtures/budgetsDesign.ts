import { homeReport } from "./homeReport";
import type { IFinancialReport } from "@/types/financialSummary/types";
import type { IBudgetSuggestions } from "@/types/budget/types";
/** UI-test fixtures only; no application imports. */
export const budgetReport: IFinancialReport = {
  ...homeReport,
  summary: {
    ...homeReport.summary,
    totalAmount: 723.75,
    netSpent: 723.75,
    netRemaining: 3476.25,
    spentPercentageOfIncome: 17.23,
  },
  budgets: [
    ...homeReport.budgets,
    {
      ...homeReport.budgets[0],
      id: "test-unbudgeted",
      category: "Entertainment",
      limit: 0,
      spent: 106,
      remaining: -106,
      utilizationPercentage: null,
      autoCreated: true,
    },
  ],
};
export const budgetSuggestions: IBudgetSuggestions = {
  month: 1,
  year: 2026,
  suggestions: [
    {
      category: "Groceries",
      suggestedLimit: 500,
      source: "PREVIOUS_MONTH_BUDGET",
      inherited: true,
      existingBudgetId: null,
      autoCreated: false,
      spentToDate: 0,
      monthsSampled: 0,
    },
    {
      category: "Entertainment",
      suggestedLimit: 150,
      source: "HISTORICAL_SPENDING",
      inherited: false,
      existingBudgetId: "test-unbudgeted",
      autoCreated: true,
      spentToDate: 106,
      monthsSampled: 3,
    },
  ],
};
