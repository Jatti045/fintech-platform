package com.fintechapp.fintech_api.dto.transaction;

public record TransactionQueryParams(
        String page,
        String limit,
        String type,
        String category,
        String currentMonth,
        String currentYear,
        String startDate,
        String endDate,
        String budgetId,
        String searchQuery
) {
}


