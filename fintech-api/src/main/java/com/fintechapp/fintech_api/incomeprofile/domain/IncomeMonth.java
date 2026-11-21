package com.fintechapp.fintech_api.incomeprofile.domain;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;

public record IncomeMonth(int year, int month) {
  public IncomeMonth {
    if (year <= 0 || month < 0 || month > 11) throw new InvalidPeriod();
  }

  public static IncomeMonth parse(String month, String year) {
    return new IncomeMonth(integer(year), integer(month));
  }

  public Instant start() {
    return firstDay().atStartOfDay().toInstant(ZoneOffset.UTC);
  }

  public Instant endExclusive() {
    return firstDay().plusMonths(1).atStartOfDay().toInstant(ZoneOffset.UTC);
  }

  private LocalDate firstDay() {
    return LocalDate.of(year, month + 1, 1);
  }

  private static int integer(String value) {
    if (value == null) throw new InvalidPeriod();
    try {
      return Integer.parseInt(value.trim());
    } catch (NumberFormatException e) {
      throw new InvalidPeriod();
    }
  }

  public static final class InvalidPeriod extends IllegalArgumentException {}
}
