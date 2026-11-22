package com.fintechapp.fintech_api.incomeupdate.application;

import java.time.Instant;

public record IncomeUpdateProfile(
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
