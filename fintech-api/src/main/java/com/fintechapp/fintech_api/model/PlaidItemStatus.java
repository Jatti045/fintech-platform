package com.fintechapp.fintech_api.model;

/**
 * Lifecycle health of a linked Plaid item.
 *
 * <p>{@link #ACTIVE} is the normal state. {@link #REQUIRES_REAUTH} is set when
 * Plaid reports {@code ITEM_LOGIN_REQUIRED} (the bank session expired and the
 * user must re-authenticate through Link update mode). The item returns to
 * {@link #ACTIVE} when the user completes update mode or Plaid sends a
 * {@code LOGIN_REPAIRED} webhook.</p>
 */
public enum PlaidItemStatus {
    ACTIVE,
    REQUIRES_REAUTH
}