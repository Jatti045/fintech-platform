package com.fintechapp.fintech_api.accountsetup.application;

import java.time.Instant;

public record SetupProfile(
    String id,
    String username,
    String email,
    String profilePic,
    String currency,
    boolean setupComplete,
    double expectedIncome,
    double actualIncome,
    Instant createdAt,
    Instant updatedAt) {}
