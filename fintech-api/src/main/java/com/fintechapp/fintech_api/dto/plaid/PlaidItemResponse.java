package com.fintechapp.fintech_api.dto.plaid;

import java.time.Instant;

/**
 * Non-sensitive summary of a linked Plaid item. The encrypted access token is
 * never exposed to clients.
 */
public record PlaidItemResponse(
        String id,
        String itemId,
        String institutionName,
        Instant createdAt) {
}