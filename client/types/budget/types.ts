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
}

export interface IBudgetData {
  category: string;
  limit: number;
  month: number;
  year: number;
}

/** One suggested budget limit from Smart Month Setup. */
export interface IBudgetSuggestion {
  category: string;
  suggestedLimit: number;
  /** Where the number came from — surfaced verbatim to the user. */
  source: "PREVIOUS_MONTH_BUDGET" | "HISTORICAL_SPENDING";
  /** True when inherited verbatim from last month's manual budget. */
  inherited: boolean;
  /** Target-month budget id when one already exists (Plaid auto-created). */
  existingBudgetId: string | null;
  /** True when that existing row was auto-created by Plaid ingestion. */
  autoCreated: boolean;
  /** Amount already spent against the existing target-month row, if any. */
  spentToDate: number;
  monthsSampled: number;
}

/** Full suggestions payload for one month. */
export interface IBudgetSuggestions {
  year: number;
  month: number;
  suggestions: IBudgetSuggestion[];
}

/** A user-confirmed item to apply. */
export interface IBudgetSuggestionApplyItem {
  category: string;
  limit: number;
}

/** Result of applying a batch of suggested budgets. */
export interface IApplySuggestionsResult {
  year: number;
  month: number;
  created: number;
  updated: number;
  skipped: number;
  skippedItems: { category: string; requestedLimit: number; reason: string }[];
  budgets: IBudget[];
}
