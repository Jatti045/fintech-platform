package com.fintechapp.fintech_api.dto.plaid;

/**
 * Response describing a persisted Plaid item linked to the authenticated user.
 */
public record ExchangeTokenResponse(
        boolean success,
        String message,
        Data data) {

    public record Data(PlaidItemResponse item) {
    }
}