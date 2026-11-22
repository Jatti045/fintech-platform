package com.fintechapp.fintech_api.incomeupdate.domain;

import java.time.YearMonth;

public record IncomeBaselineChange(YearMonth period, double amount) {
  public static IncomeBaselineChange from(Double amount, Integer month, Integer year) {
    if (amount == null) throw new MissingAmount();
    // Preserve the existing update policy. The setup command validates finiteness separately.
    if (amount < 0) throw new NegativeAmount();
    if (month == null || year == null) throw new MissingPeriod();
    if (month < 0 || month > 11 || year <= 0) throw new InvalidPeriod();
    return new IncomeBaselineChange(YearMonth.of(year, month + 1), amount);
  }

  public static final class MissingAmount extends RuntimeException {}

  public static final class NegativeAmount extends RuntimeException {}

  public static final class MissingPeriod extends RuntimeException {}

  public static final class InvalidPeriod extends RuntimeException {}
}
