package com.fintechapp.fintech_api.service;

/** Expected rejection of a page whose lease or input cursor is no longer current. */
public class StalePlaidSyncPageException extends RuntimeException {
    public StalePlaidSyncPageException(String itemId) {
        super("Plaid sync ownership or cursor is stale for item_id=" + itemId);
    }
}
