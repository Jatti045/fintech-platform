package com.fintechapp.fintech_api.dto.user;

import jakarta.validation.constraints.NotNull;

public record UpdateAiPrivacyRequest(@NotNull Boolean enabled, String disclosureVersion) { }
