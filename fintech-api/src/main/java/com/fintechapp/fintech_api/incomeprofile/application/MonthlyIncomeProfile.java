package com.fintechapp.fintech_api.incomeprofile.application;

import java.time.Instant;

public record MonthlyIncomeProfile(Profile profile, double expectedIncome, double actualIncome) {
  public record Profile(
      String id,
      String username,
      String email,
      String profilePic,
      String currency,
      boolean setupComplete,
      Instant createdAt,
      Instant updatedAt) {}
}
