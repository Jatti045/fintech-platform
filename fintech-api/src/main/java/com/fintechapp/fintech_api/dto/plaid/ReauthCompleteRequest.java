package com.fintechapp.fintech_api.dto.plaid;

import jakarta.validation.constraints.NotBlank;

/**
 * Body sent by the client after the user completes Plaid Link <em>update
 * mode</em>. The access token is unchanged so no public-token exchange occurs;
 * the server simply clears the {@code REQUIRES_REAUTH} flag and triggers a
 * transaction sync.
 */
public record ReauthCompleteRequest(
        @NotBlank(message = "itemId is required") String itemId) {
}