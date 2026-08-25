package com.fintechapp.fintech_api.dto.budget;

import java.util.List;

/**
 * Response for {@code POST /api/budgets/apply-suggestions}.
 *
 * <p>{@code skippedItems} reports every selection the server refused to write
 * and why, so the client can explain the outcome honestly instead of guessing:
 * a manually configured limit is never overwritten, and duplicated categories
 * within one request are applied once.</p>
 */
public record ApplyBudgetSuggestionsResponse(boolean success, String message, Data data) {

        public record Data(
                        int year,
                        int month,
                        int created,
                        int updated,
                        int skipped,
                        List<SkippedItem> skippedItems,
                        List<BudgetItemResponse> budgets) {
        }

        public record SkippedItem(String category, double requestedLimit, String reason) {
        }
}