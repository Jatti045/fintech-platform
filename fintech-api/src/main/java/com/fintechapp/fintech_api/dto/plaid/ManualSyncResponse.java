package com.fintechapp.fintech_api.dto.plaid;

/**
 * Acknowledgment that an on-demand transaction sync was requested for an item.
 * The actual sync runs on a background thread and its outcome is reflected by
 * the item's {@code lastSyncedAt} / {@code syncError} health fields.
 */
public record ManualSyncResponse(
        boolean success,
        String message,
        Data data) {

    public record Data(String itemId) {
    }
}