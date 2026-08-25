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
