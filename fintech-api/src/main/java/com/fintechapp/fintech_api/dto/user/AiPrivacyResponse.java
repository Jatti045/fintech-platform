package com.fintechapp.fintech_api.dto.user;

import java.time.Instant;

public record AiPrivacyResponse(boolean success, String message, Data data) {
    public record Data(boolean enabled, String disclosureVersion, Instant updatedAt,
            String providerName, String privacyPolicyUrl) { }
}
