package com.fintechapp.fintech_api.dto.plaid;

import jakarta.validation.constraints.NotBlank;

/**
 * Body received from the mobile client after the user completes the
 * native Plaid Link flow. The short-lived public token is exchanged for a
 * durable access token server-side.
 */
public record ExchangePublicTokenRequest(
        @NotBlank(message = "publicToken is required") String publicToken) {
}