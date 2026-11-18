package com.fintechapp.fintech_api.dto.user;

import java.time.Instant;

public record UserSummaryResponse(
    String id,
    String username,
    String email,
    String profilePic,
    String currency,
    boolean setupComplete,
    double monthlyIncome,
    double actualMonthlyIncome,
    Instant createdAt,
    Instant updatedAt) {}
