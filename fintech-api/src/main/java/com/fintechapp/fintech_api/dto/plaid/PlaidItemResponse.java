package com.fintechapp.fintech_api.dto.plaid;

import java.time.Instant;

/**
 * Non-sensitive summary of a linked Plaid item. The encrypted access token is
 * never exposed to clients. Item health fields (status, sync error, last sync,
 * re-auth requested time) drive the client-side banners and timestamps.
 */
public record PlaidItemResponse(
        String id,
        String itemId,
        String institutionName,
        Instant createdAt,
        String status,
        boolean syncError,
        Instant lastSyncedAt,
        Instant reauthRequestedAt) {
}