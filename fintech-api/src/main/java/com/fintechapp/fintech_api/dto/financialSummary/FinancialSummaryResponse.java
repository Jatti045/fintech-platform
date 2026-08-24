package com.fintechapp.fintech_api.dto.financialSummary;

/**
 * Month-scoped financial aggregates for the authenticated user.
 *
 * <p>{@code totalAmount} is the month's total spending — the sum of EXPENSE
 * transactions. {@code monthlyIncome} is the effective income (actual inflow
 * when present, otherwise the expected baseline the user set on their
 * profile), matching the strategy used by {@code IncomeCalculationService}.
 */
public record FinancialSummaryResponse(
        boolean success,
        String message,
        FinancialSummaryData data) {

    public record FinancialSummaryData(
            double totalAmount,
            double monthlyIncome,
            double expectedIncome,
            double actualIncome,
            double netSpent,
            double netRemaining,
            double spentPercentageOfIncome) {
    }
}
