package com.fintechapp.fintech_api.recurring.domain;

import java.time.Instant;

public record ExpenseObservation(
    String id,
    String name,
    double amount,
    Instant date,
    String currency,
    boolean expense,
    boolean transfer) {}
