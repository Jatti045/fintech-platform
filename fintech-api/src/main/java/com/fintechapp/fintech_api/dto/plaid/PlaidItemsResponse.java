package com.fintechapp.fintech_api.dto.plaid;

import java.util.List;

/**
 * Response containing every active Plaid item linked to the authenticated
 * user, ordered by connection date (newest first).
 */
public record PlaidItemsResponse(
        boolean success,
        String message,
        Data data) {

    public record Data(List<PlaidItemResponse> items) {
    }
}
