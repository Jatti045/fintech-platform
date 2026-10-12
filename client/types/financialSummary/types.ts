// ─── Financial Summary Domain Types ─────────────────────────────────────────
//
// Month-scoped financial aggregates. This domain is fully separate from the
// transaction domain: transactions answer "what transactions exist", while the
// financial summary answers "how is the month tracking financially".

export interface IFinancialSummary {
  totalAmount: number;
  monthlyIncome: number;
  expectedIncome: number;
  actualIncome: number;
  netSpent: number;
  netRemaining: number;
  spentPercentageOfIncome: number;
}

export interface IFinancialSummaryResponse {
  success: boolean;
  message: string;
  data: IFinancialSummary;
}

export interface FinancialSummaryState {
  data: IFinancialSummary | null;
  isLoading: boolean;
  error: string | null;
}

export interface IFinancialReport {
  year: number; month: number; currency: string; generatedAt: string;
  incomeBasis: "ACTUAL" | "EXPECTED" | "UNCONFIGURED";
  expectedIncomeConfigured: boolean; transactionCount: number;
  summary: IFinancialSummary; grossExpenses: number; expenseCredits: number;
  daily: { day: number; grossExpenses: number; expenseCredits: number; netSpent: number }[];
  categories: { category: string; grossExpenses: number; expenseCredits: number; netSpent: number }[];
  budgets: { id: string; category: string; limit: number; spent: number; remaining: number; utilizationPercentage: number | null; autoCreated: boolean; userId: string; date: string; createdAt: string; updatedAt: string }[];
  previousPeriod: { year: number; month: number; actualIncome: number; netSpent: number; actualIncomeChange: number; netSpentChange: number; incomeChangePercentage: number | null; spendingChangePercentage: number | null };
}
