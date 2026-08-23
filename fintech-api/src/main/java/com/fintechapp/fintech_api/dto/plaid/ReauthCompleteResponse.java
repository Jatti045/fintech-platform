package com.fintechapp.fintech_api.dto.plaid;

/**
 * Confirmation that a re-authentication flow completed and the item is back to
 * the active state.
 */
public record ReauthCompleteResponse(
        boolean success,
        String message,
        Data data) {

    public record Data(String itemId, String status) {
    }
}