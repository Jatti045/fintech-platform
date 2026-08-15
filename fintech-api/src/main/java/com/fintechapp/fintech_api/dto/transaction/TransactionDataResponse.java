package com.fintechapp.fintech_api.dto.transaction;

public record TransactionDataResponse(
        boolean success,
        String message,
        Data data) {
    public record Data(
            TransactionsResponse.TransactionItem transaction) {
    }
}
