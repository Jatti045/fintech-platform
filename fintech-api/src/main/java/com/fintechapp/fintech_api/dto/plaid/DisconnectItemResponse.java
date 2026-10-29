package com.fintechapp.fintech_api.dto.plaid;

/**
 * Response confirming local disconnection and durable scheduling of remote revocation.
 */
public record DisconnectItemResponse(
        boolean success,
        String message,
        Data data) {

    public record Data(String deletedItemId) {
    }
}
