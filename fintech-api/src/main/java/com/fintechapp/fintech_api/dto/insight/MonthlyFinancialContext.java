package com.fintechapp.fintech_api.dto.insight;

import java.util.List;

/**
 * The structured, minimum-necessary financial facts Budgee sends to the AI
 * provider for the monthly explanation. Every value here is computed by
 * Budgee's deterministic services — the AI never calculates or classifies.
 *
 * <p>Month representation: {@code month} is the human-readable 1-based month
 * (1 = January … 12 = December) and {@code monthName} spells it out. The API
 * itself uses Budgee's zero-based month convention; the conversion happens
 * exactly once, when this context is built, so the AI never sees a 0-based
 * index and mistakes September for August.</p>
 *
 * <p>Deliberately excluded: database/account/Plaid IDs, raw transactions, and
 * any credential material. Only aggregate facts cross the boundary.</p>
 */
public record MonthlyFinancialContext(
                int year,
                /** Human-readable 1-based month: 1 = January … 12 = December. */
                int month,
                /** Full month name, e.g. "September" — removes all ambiguity for the AI. */
                String monthName,
                String currency,
                double income,
                double expectedIncome,
                double actualIncome,
                double expenses,
                double net,
                double spentPercentageOfIncome,
                List<CategorySpend> categories,
                List<BudgetStatus> budgets,
                List<RecurringChange> recurringChanges) {

        /** One category's current-month spending vs the previous month. */
        public record CategorySpend(
                        String category,
                        double total,
                        Double previousTotal,
                        /** Percentage change vs previous month; null when there is no prior baseline. */
                        Double changePercent) {
        }

        /** One budget's usage for the month. */
        public record BudgetStatus(
                        String category,
                        double limit,
                        double spent,
                        double percentUsed) {
        }

        /** A recurring payment whose amount meaningfully changed recently. */
        public record RecurringChange(
                        String name,
                        double previousAmount,
                        double currentAmount) {
        }
}
