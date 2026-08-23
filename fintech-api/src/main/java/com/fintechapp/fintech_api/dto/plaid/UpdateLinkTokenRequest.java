package com.fintechapp.fintech_api.dto.plaid;

import jakarta.validation.constraints.NotBlank;

/**
 * Body for requesting an <em>update-mode</em> Plaid Link token for an existing
 * item. {@code itemId} is our internal {@code PlaidItem.id} (UUID), scoped to
 * the authenticated user.
 */
public record UpdateLinkTokenRequest(
        @NotBlank(message = "itemId is required") String itemId) {
}