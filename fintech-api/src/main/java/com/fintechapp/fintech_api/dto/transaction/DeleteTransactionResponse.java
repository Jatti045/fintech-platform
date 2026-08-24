package com.fintechapp.fintech_api.dto.transaction;

public record DeleteTransactionResponse(
        boolean success,
        String message,
        Data data
) {
    public record Data(
            String deletedTransactionId,
            RestoredBudget restoredBudget
    ) {
    }

    public record RestoredBudget(String budgetId, double amountRestored) {
    }
}


