package com.fintechapp.fintech_api.dto.financialSummary;

import java.time.Instant;
import java.util.List;

public record FinancialReportResponse(boolean success, String message, Report data) {
    public record Report(int year, int month, String currency, Instant generatedAt, String incomeBasis,
            boolean expectedIncomeConfigured, long transactionCount,
            FinancialSummaryResponse.FinancialSummaryData summary, double grossExpenses, double expenseCredits,
            List<Daily> daily, List<Category> categories, List<BudgetUsage> budgets, Comparison previousPeriod) {}
    public record Daily(int day, double grossExpenses, double expenseCredits, double netSpent) {}
    public record Category(String category, double grossExpenses, double expenseCredits, double netSpent) {}
    public record BudgetUsage(String id, String category, double limit, double spent, double remaining,
            Double utilizationPercentage, boolean autoCreated, String userId, Instant date, Instant createdAt, Instant updatedAt) {}
    public record Comparison(int year, int month, double actualIncome, double netSpent,
            double actualIncomeChange, double netSpentChange, Double incomeChangePercentage, Double spendingChangePercentage) {}
}
