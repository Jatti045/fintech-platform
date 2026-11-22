package com.fintechapp.fintech_api.currencyupdate.application;

import java.time.Instant;

public record CurrencyProfile(
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
