package com.fintechapp.fintech_api.dto.plaid;

/**
 * Response containing a freshly created Plaid Link token for the
 * authenticated user.
 */
public record LinkTokenResponse(
        boolean success,
        String message,
        Data data) {

    public record Data(String linkToken) {
    }
}