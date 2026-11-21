package com.fintechapp.fintech_api.reporting.domain;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public record FinancialFacts(
    List<Row> current,
    double expectedIncome,
    boolean expectedIncomeConfigured,
    List<Budget> budgets,
    List<Row> previous) {
  public record Actor(String id, String currency) {}

  public record Row(
      int day,
      String category,
      String budgetId,
      BigDecimal gross,
      BigDecimal credits,
      BigDecimal income,
      long count) {}

  public record Budget(
      String id,
      String category,
      double limit,
      boolean autoCreated,
      Instant date,
      Instant createdAt,
      Instant updatedAt) {}
}
