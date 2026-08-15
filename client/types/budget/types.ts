// ─── Budget Domain Types ────────────────────────────────────────────────────

import type { ITransaction } from "@/types/transaction/types";

export interface IBudget {
  id: string;
  date: Date;
  category: string;
  limit: number;
  spent: number;
  userId: string;
  createdAt: string;
  updatedAt: string;
  autoCreated?: boolean;
  transactions?: ITransaction[];
}

/**
 * A budget enriched with the amounts actually shown in the UI.
 *
 * Produced by `useBudgetDisplayAmounts`: `limit` stays canonical (authored in
 * the user's default currency), while `spent` may be currency-converted for
 * display and `displayCurrency` is the normalized active currency. UI
 * components consume these fields directly instead of re-deriving them.
 */
export interface DisplayBudget extends IBudget {
  displayLimit: number;
  displaySpent: number;
  displayCurrency: string;
}

export interface BudgetState {
  budgets: IBudget[];
  loading: boolean;
  error: string | null;
  latestRequestId?: string | null;
}

export interface IBudgetData {
  category: string;
  limit: number;
  month: number;
  year: number;
}
