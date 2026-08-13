package com.fintechapp.fintech_api.dto.plaid;

/**
 * Response confirming that a Plaid item was revoked (via /item/remove) and
 * deleted from the database.
 */
public record DisconnectItemResponse(
        boolean success,
        String message,
        Data data) {

    public record Data(String deletedItemId) {
    }
}
