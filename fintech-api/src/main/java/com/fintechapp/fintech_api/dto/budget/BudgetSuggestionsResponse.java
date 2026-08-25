package com.fintechapp.fintech_api.dto.budget;

import java.util.List;

/**
 * One suggested budget limit for a target month, produced by
 * {@code BudgetSuggestionService}.
 *
 * <p>Suggestions are conservative and explainable: {@code source} states where
 * the number came from ({@code PREVIOUS_MONTH_BUDGET} inherits the user's own
 * prior decision; {@code HISTORICAL_SPENDING} estimates from completed-month
 * activity), and {@code existingBudgetId} is non-null when the target month
 * already carries a Plaid auto-created $0 budget for the category — applying
 * then sets that budget's limit instead of creating a duplicate.</p>
 */
public record BudgetSuggestionsResponse(boolean success, String message, Data data) {

        public record Data(int year, int month, List<Item> suggestions) {
        }

        public record Item(
                        String category,
                        double suggestedLimit,
                        /** {@code PREVIOUS_MONTH_BUDGET} | {@code HISTORICAL_SPENDING}. */
                        String source,
                        /** True when inherited verbatim from the previous month's manual budget. */
                        boolean inherited,
                        /** Budget id when the target month already has a row for this category. */
                        String existingBudgetId,
                        /** True when that existing row was auto-created by Plaid ingestion. */
                        boolean autoCreated,
                        /** Amount already spent against the existing target-month row, if any. */
                        double spentToDate,
                        /** Completed months of spending evidence behind an estimate (0 for inherited). */
                        int monthsSampled) {
        }
}